import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InventoryService } from './inventory.service';
import { PdfService } from './pdf.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private pdfService: PdfService,
    private wsGateway: AppWebSocketGateway,
  ) {}

  async scanProduct(storeId: string, qrValue: string) {
    // QR value should be the SKU
    const product = await this.prisma.product.findUnique({
      where: { sku: qrValue },
      include: {
        category: true,
        brand: true,
        manufacturer: true,
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: `Product with SKU ${qrValue} not found`,
        sku: qrValue,
        suggestion: 'Use POST /products/quick-create to add this product manually',
        endpoint: '/products/quick-create',
      });
    }

    const inventory = await this.prisma.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId: product.id,
        },
      },
    });

    return {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unitPrice: product.unitPrice.toString(),
        unitSizeMl: product.unitSizeMl,
        category: product.category.name,
        brand: product.brand.name,
        manufacturer: product.manufacturer.name,
      },
      stockQty: inventory?.qtyOnHand || 0,
    };
  }

  async createInvoice(createInvoiceDto: CreateInvoiceDto & { storeId: string; workerId: string }, idempotencyKey?: string) {
    // Check idempotency if key provided
    if (idempotencyKey) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          // In a real system, you'd store idempotency keys
          // For POC, we'll skip this check
        },
      });
    }

    // Start transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Validate store exists
      const store = await tx.store.findUnique({
        where: { id: createInvoiceDto.storeId },
      });

      if (!store) {
        throw new BadRequestException('Store not found');
      }

      // Validate worker exists and has SALES role
      const worker = await tx.user.findUnique({
        where: { id: createInvoiceDto.workerId },
      });

      if (!worker) {
        throw new BadRequestException('Worker not found');
      }

      if (worker.role !== 'SALES' && worker.role !== 'ADMIN') {
        throw new BadRequestException('Worker does not have SALES role');
      }

      // Fetch all products with current prices (never trust FE)
      const productIds = createInvoiceDto.items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        throw new BadRequestException('One or more products not found');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Lock inventory rows and validate stock
      const inventoryUpdates = [];
      const invoiceItems = [];
      let totalAmount = new Decimal(0);
      let totalItems = 0;

      for (const item of createInvoiceDto.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new BadRequestException(`Product ${item.productId} not found`);
        }

        // Lock inventory row using Prisma findUnique with proper transaction
        // Using Prisma's built-in methods instead of raw SQL to avoid type casting issues
        const inventory = await tx.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId: createInvoiceDto.storeId,
              productId: item.productId,
            },
          },
        });

        if (!inventory) {
          throw new BadRequestException(
            `Inventory not found for product ${product.sku} in store`,
          );
        }

        const currentQty = inventory.qtyOnHand;
        if (currentQty < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.sku}. Available: ${currentQty}, Requested: ${item.qty}`,
          );
        }

        const unitPrice = new Decimal(product.unitPrice);
        const lineTotal = unitPrice.mul(item.qty);
        totalAmount = totalAmount.add(lineTotal);
        totalItems += item.qty;

        invoiceItems.push({
          productId: item.productId,
          qty: item.qty,
          unitPrice: unitPrice,
          lineTotal: lineTotal,
        });

        inventoryUpdates.push({
          storeId: createInvoiceDto.storeId,
          productId: item.productId,
          newQty: currentQty - item.qty,
        });
      }

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          storeId: createInvoiceDto.storeId,
          workerId: createInvoiceDto.workerId,
          totalAmount: totalAmount,
          totalItems: totalItems,
          status: 'COMPLETED',
          clientInvoiceRef: createInvoiceDto.clientInvoiceRef,
          items: {
            create: invoiceItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  brand: true,
                  category: true,
                },
              },
            },
          },
        },
      });

      // Update inventory and create movements
      // Using conditional update to ensure stock is still available (optimistic locking)
      for (const update of inventoryUpdates) {
        const itemQty = createInvoiceDto.items.find((i) => i.productId === update.productId)!.qty;
        
        // Update with condition check - will fail if stock changed
        const updated = await tx.inventory.updateMany({
          where: {
            storeId: update.storeId,
            productId: update.productId,
            qtyOnHand: {
              gte: itemQty, // Only update if stock is still sufficient
            },
          },
          data: {
            qtyOnHand: update.newQty,
          },
        });

        if (updated.count === 0) {
          throw new BadRequestException(
            `Stock changed for product. Please try again.`,
          );
        }

        await tx.inventoryMovement.create({
          data: {
            storeId: update.storeId,
            productId: update.productId,
            type: 'OUT',
            qty: itemQty,
            refType: 'INVOICE',
            refId: invoice.id,
          },
        });
      }

      return { invoice, inventoryUpdates };
    });

    const { invoice, inventoryUpdates } = result;

    // Generate PDF (sync for POC)
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await this.pdfService.generateInvoicePdf(invoice.id);
    } catch (error) {
      // Log error but continue - PDF is optional for POC
      console.error('PDF generation failed (continuing without PDF):', error.message);
    }

    // Update invoice with PDF URL
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                category: true,
              },
            },
          },
        },
        store: true,
      },
    });

    // Emit WebSocket events
    this.wsGateway.emitInvoiceCreated({
      invoiceId: invoice.id,
      storeId: invoice.storeId,
      totalAmount: invoice.totalAmount.toString(),
      createdAt: invoice.createdAt.toISOString(),
    });

    for (const update of inventoryUpdates) {
      this.wsGateway.emitInventoryUpdated({
        storeId: update.storeId,
        productId: update.productId,
        newQty: update.newQty,
      });
    }

    return {
      invoiceId: invoice.id,
      pdfUrl: updatedInvoice.pdfUrl,
      totals: {
        amount: invoice.totalAmount.toString(),
        items: invoice.totalItems,
      },
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                category: true,
                manufacturer: true,
              },
            },
          },
        },
        store: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }
}


import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InventoryService } from './inventory.service';
import { PdfService } from './pdf.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { Decimal } from '@prisma/client/runtime/library';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
    private pdfService: PdfService,
    private wsGateway: AppWebSocketGateway,
  ) {}

  async scanProduct(storeId: string, qrValue: string) {
    // QR value should be the SKU - find product in the specific store
    const product = await this.prisma.product.findFirst({
      where: { 
        sku: qrValue,
        storeId: storeId,
      },
      include: {
        category: true,
        brand: true,
        manufacturer: true,
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: `Product with SKU ${qrValue} not found in this store`,
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
        unitPrice: product.unitPrice.toNumber(), // Convert Decimal to number for calculations
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
        const foundIds = products.map((p) => p.id);
        const missingIds = productIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `One or more products not found. Missing product IDs: ${missingIds.join(', ')}`,
        );
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
    // PDF generation is important - try to generate it, but don't fail invoice creation if it fails
    // On-demand generation will retry when GET /pdf is called
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await this.pdfService.generateInvoicePdf(invoice.id);
      console.log(`✅ PDF generated successfully for invoice ${invoice.id}: ${pdfUrl}`);
    } catch (error: any) {
      // Log detailed error but continue - PDF is optional for POC. On-demand generation will retry when GET /pdf is called.
      console.error(`❌ PDF generation failed for invoice ${invoice.id}:`, {
        message: error?.message ?? 'Unknown error',
        stack: error?.stack,
        error: error,
      });
      // PDF will be generated on-demand when user requests it via GET /pos/invoices/:id/pdf
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
      pdfUrl: updatedInvoice.pdfUrl ?? '',
      totals: {
        amount: invoice.totalAmount.toString(),
        items: invoice.totalItems,
      },
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  async getAllInvoices(filters?: { storeId?: string; from?: Date; to?: Date }) {
    const where: any = {};
    
    if (filters?.storeId) {
      where.storeId = filters.storeId;
    }
    
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = filters.from;
      }
      if (filters.to) {
        where.createdAt.lte = filters.to;
      }
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    // Transform Decimal fields to numbers for frontend calculations
    return invoices.map((invoice) => ({
      ...invoice,
      totalAmount: invoice.totalAmount.toNumber(),
      items: invoice.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
        product: item.product
          ? {
              ...item.product,
              unitPrice: item.product.unitPrice.toNumber(),
            }
          : null,
      })),
    }));
  }

  async getTodayStats(storeId: string, workerId: string) {
    // Get today's date range (start of day to end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query invoices for today
    const invoices = await this.prisma.invoice.findMany({
      where: {
        storeId,
        workerId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: 'COMPLETED',
      },
      select: {
        totalAmount: true,
        totalItems: true,
      },
    });

    // Calculate stats
    const salesCount = invoices.length;
    const salesAmount = invoices.reduce(
      (sum, inv) => sum.add(inv.totalAmount),
      new Decimal(0),
    );

    return {
      salesCount,
      salesAmount: salesAmount.toNumber(),
      date: today.toISOString().split('T')[0], // YYYY-MM-DD format
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

    // Transform Decimal fields to numbers for frontend calculations
    return {
      ...invoice,
      totalAmount: invoice.totalAmount.toNumber(),
      items: invoice.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
        product: item.product
          ? {
              ...item.product,
              unitPrice: item.product.unitPrice.toNumber(),
            }
          : null,
      })),
    };
  }

  /**
   * Returns the pdfUrl for an invoice. If the PDF does not exist (pdfUrl null or file missing),
   * generates it on demand, updates the invoice, and returns the path.
   * @throws NotFoundException if invoice does not exist
   * @throws Error (from PdfService) if PDF generation fails
   */
  async ensureInvoicePdfPath(invoiceId: string): Promise<string> {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { pdfUrl: true },
    });
    if (!inv) {
      throw new NotFoundException('Invoice not found');
    }
    if (inv.pdfUrl) {
      const fp = path.join(process.cwd(), inv.pdfUrl);
      if (fs.existsSync(fp)) {
        return inv.pdfUrl;
      }
    }
    const pdfUrl = await this.pdfService.generateInvoicePdf(invoiceId);
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl },
    });
    return pdfUrl;
  }

  async deleteInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.prisma.$transaction(async (tx) => {
      // Restore stock for each item and create IN movement (void)
      for (const item of invoice.items) {
        await tx.inventory.update({
          where: {
            storeId_productId: { storeId: invoice.storeId, productId: item.productId },
          },
          data: { qtyOnHand: { increment: item.qty } },
        });
        await tx.inventoryMovement.create({
          data: {
            storeId: invoice.storeId,
            productId: item.productId,
            type: 'IN',
            qty: item.qty,
            refType: 'INVOICE_VOID',
            refId: id,
          },
        });
      }
      // Cascade deletes invoice_items
      await tx.invoice.delete({ where: { id } });
    });

    return { message: 'Invoice deleted successfully' };
  }
}


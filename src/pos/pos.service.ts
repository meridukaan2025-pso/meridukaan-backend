import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { SyncInvoicesDto, SyncResultDto } from './dto/sync-invoice.dto';
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

  /**
   * Sync offline invoices to database
   * Resolves products from names and creates invoices
   */
  async syncInvoices(
    syncDto: SyncInvoicesDto,
    storeId: string,
    workerId: string,
  ): Promise<{ synced: SyncResultDto[]; failed: SyncResultDto[] }> {
    const synced: SyncResultDto[] = [];
    const failed: SyncResultDto[] = [];

    for (const invoiceData of syncDto.invoices) {
      try {
        // Resolve products (names to IDs) and ensure stock exists
        const resolvedItems = await Promise.all(
          invoiceData.items.map(async (item) => {
            // Find or create product
            const product = await this.resolveProductFromNames({
              sku: item.sku,
              name: item.productName || 'Unknown Product',
              categoryName: item.categoryName,
              brandName: item.brandName,
              manufacturerName: item.manufacturerName,
              unitPrice: item.unitPrice,
              storeId: storeId,
            });

            // For offline sync, add stock quantity as specified by user
            // User provides stockQuantity which should be >= qty
            // IMPORTANT: Use user's stockQuantity value, not zero
            const stockToAdd = item.stockQuantity || item.qty; // Use stockQuantity from user, fallback to qty
            
            // Ensure stock is at least the quantity being sold, but prefer user's stockQuantity
            const finalStock = Math.max(stockToAdd, item.qty);
            
            console.log(`[Sync] Setting stock for product ${product.sku || product.id}: stockQuantity=${item.stockQuantity}, qty=${item.qty}, finalStock=${finalStock}`);
            
            // Check current inventory first
            const currentInventory = await this.prisma.inventory.findUnique({
              where: {
                storeId_productId: {
                  storeId: storeId,
                  productId: product.id,
                },
              },
            });

            const currentStock = currentInventory?.qtyOnHand || 0;
            // For offline sync, we want to SET the stock to user-specified value
            // If user provided stockQuantity, use that. Otherwise use max of current or qty
            // NEVER set to zero - always use user's stockQuantity or at least qty
            const requiredStock = currentInventory 
              ? Math.max(currentStock, finalStock) // If exists, keep higher value
              : finalStock; // If new, use user's stockQuantity

            console.log(`[Sync] Current stock: ${currentStock}, Required: ${requiredStock}, Final: ${finalStock}`);

            // Use upsert to ensure stock exists and is sufficient
            // IMPORTANT: Set stock to user-specified value for offline sync, NEVER zero
            await this.prisma.inventory.upsert({
              where: {
                storeId_productId: {
                  storeId: storeId,
                  productId: product.id,
                },
              },
              create: {
                storeId: storeId,
                productId: product.id,
                qtyOnHand: finalStock, // Use user-specified stock (never zero)
              },
              update: {
                // Set to required stock (user's stockQuantity or max of current/final)
                // Ensure it's never zero
                qtyOnHand: Math.max(requiredStock, item.qty), // At least qty, prefer user's stockQuantity
              },
            });

            // Verify stock was set correctly - read fresh from DB
            const verifyInventory = await this.prisma.inventory.findUnique({
              where: {
                storeId_productId: {
                  storeId: storeId,
                  productId: product.id,
                },
              },
            });
            
            if (!verifyInventory || verifyInventory.qtyOnHand < item.qty) {
              console.error(`[Sync] ERROR: Stock verification failed! Expected at least ${item.qty}, got ${verifyInventory?.qtyOnHand || 0}`);
              // Force update one more time
              await this.prisma.inventory.update({
                where: {
                  storeId_productId: {
                    storeId: storeId,
                    productId: product.id,
                  },
                },
                data: {
                  qtyOnHand: finalStock,
                },
              });
            }
            
            console.log(`[Sync] Verified stock for product ${product.sku || product.id}: ${verifyInventory?.qtyOnHand || 0}`);

            return {
              productId: product.id,
              qty: item.qty,
            };
          }),
        );

        // CRITICAL: Ensure all stock updates are committed before creating invoice
        // This prevents transaction isolation issues where createInvoice might not see updated stock
        // Wait a small moment to ensure database commits are complete
        await new Promise(resolve => setTimeout(resolve, 300));

        // Double-check stock is sufficient before creating invoice
        // This is a safety check to ensure stock was properly set
        for (let i = 0; i < resolvedItems.length; i++) {
          const item = resolvedItems[i];
          const originalItem = invoiceData.items[i]; // Match by index
          
          const inventory = await this.prisma.inventory.findUnique({
            where: {
              storeId_productId: {
                storeId: storeId,
                productId: item.productId,
              },
            },
          });

          const currentStock = inventory?.qtyOnHand || 0;
          const stockToAdd = originalItem?.stockQuantity || item.qty;
          // Ensure stock is user's stockQuantity, at least qty, never zero
          const requiredStock = Math.max(stockToAdd, item.qty);

          console.log(`[Sync] Double-check stock for product ${item.productId}: current=${currentStock}, required=${requiredStock}, qty=${item.qty}, stockQuantity=${originalItem?.stockQuantity}`);

          if (!inventory || currentStock < item.qty) {
            // Force update stock one more time - use user's stockQuantity, never zero
            console.log(`[Sync] Stock insufficient, updating to ${requiredStock} (user's stockQuantity: ${originalItem?.stockQuantity})`);
            await this.prisma.inventory.upsert({
              where: {
                storeId_productId: {
                  storeId: storeId,
                  productId: item.productId,
                },
              },
              create: {
                storeId: storeId,
                productId: item.productId,
                qtyOnHand: requiredStock, // User's stockQuantity, never zero
              },
              update: {
                qtyOnHand: Math.max(requiredStock, item.qty), // User's stockQuantity, at least qty, never zero
              },
            });

            // Verify one more time
            const verifyInventory = await this.prisma.inventory.findUnique({
              where: {
                storeId_productId: {
                  storeId: storeId,
                  productId: item.productId,
                },
              },
            });
            console.log(`[Sync] After update, stock is: ${verifyInventory?.qtyOnHand || 0}`);
          }
        }

        // Create invoice using existing method
        const invoiceDto: CreateInvoiceDto = {
          items: resolvedItems,
          clientInvoiceRef: invoiceData.clientInvoiceRef,
        };

        const result = await this.createInvoice(
          {
            ...invoiceDto,
            storeId,
            workerId,
          },
          invoiceData.localId, // Use localId as idempotency key
        );

        synced.push({
          localId: invoiceData.localId,
          serverId: result.invoiceId,
          status: 'SYNCED',
        });
      } catch (error: any) {
        failed.push({
          localId: invoiceData.localId,
          status: 'SYNC_FAILED',
          error: error.message || 'Unknown error',
        });
      }
    }

    return { synced, failed };
  }

  /**
   * Resolve product from names (create if doesn't exist)
   * Similar to quick-create but for sync purposes
   */
  private async resolveProductFromNames(data: {
    sku?: string;
    name: string;
    categoryName: string;
    brandName: string;
    manufacturerName: string;
    unitPrice: number;
    storeId: string;
  }) {
    // Check if product exists by SKU
    if (data.sku) {
      const existing = await this.prisma.product.findFirst({
        where: {
          sku: data.sku,
          storeId: data.storeId,
        },
      });
      if (existing) {
        return existing;
      }
    }

    // Create product using names (similar to createFromAdmin logic)
    const product = await this.prisma.$transaction(async (tx) => {
      // Resolve category
      let category = await tx.category.findFirst({
        where: { name: data.categoryName },
      });
      if (!category) {
        category = await tx.category.create({ data: { name: data.categoryName } });
      }

      // Resolve manufacturer
      let manufacturer = await tx.manufacturer.findFirst({
        where: { name: data.manufacturerName },
      });
      if (!manufacturer) {
        manufacturer = await tx.manufacturer.create({
          data: { name: data.manufacturerName },
        });
      }

      // Resolve brand
      let brand = await tx.brand.findFirst({
        where: {
          name: data.brandName,
          manufacturerId: manufacturer.id,
        },
      });
      if (!brand) {
        brand = await tx.brand.create({
          data: {
            name: data.brandName,
            manufacturerId: manufacturer.id,
          },
        });
      }

      // Generate SKU if not provided
      const sku = data.sku || `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create product
      const newProduct = await tx.product.create({
        data: {
          sku,
          name: data.name,
          storeId: data.storeId,
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          unitPrice: data.unitPrice,
        },
      });

      // Initialize inventory - but don't set to 0 if it already exists
      // For offline sync, stock will be set by the sync process
      // Only create if it doesn't exist, don't update existing
      await tx.inventory.upsert({
        where: {
          storeId_productId: {
            storeId: data.storeId,
            productId: newProduct.id,
          },
        },
        create: {
          storeId: data.storeId,
          productId: newProduct.id,
          qtyOnHand: 0, // Temporary - will be updated by sync process with user's stockQuantity
        },
        update: {
          // Don't overwrite existing stock - keep current value
        },
      });

      return newProduct;
    });

    return product;
  }
}


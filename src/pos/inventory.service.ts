import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getInventoryByStore(storeId?: string) {
    return this.prisma.inventory.findMany({
      where: storeId ? { storeId } : undefined,
      include: {
        product: {
          include: {
            brand: true,
            category: true,
          },
        },
        store: true,
      },
      orderBy: [
        { storeId: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async getInventoryByProduct(productId: string) {
    return this.prisma.inventory.findMany({
      where: { productId },
      include: {
        store: true,
      },
    });
  }

  async getInventoryMovements(filters: {
    storeId?: string;
    productId?: string;
    from?: Date;
    to?: Date;
  }) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        ...(filters.storeId && { storeId: filters.storeId }),
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      include: {
        product: true,
        store: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPurchases(storeId?: string) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        type: 'IN',
        refType: 'PURCHASE',
        ...(storeId && { storeId }),
      },
      include: {
        product: {
          include: {
            brand: true,
            category: true,
          },
        },
        store: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by refId to create purchase orders
    const purchaseMap = new Map();
    
    for (const movement of movements) {
      const refId = movement.refId || movement.id;
      if (!purchaseMap.has(refId)) {
        purchaseMap.set(refId, {
          id: refId,
          purchaseNumber: `PO-${refId.substring(0, 8).toUpperCase()}`,
          store: movement.store,
          date: movement.createdAt,
          status: 'COMPLETED',
          items: [],
          total: 0,
        });
      }
      
      const purchase = purchaseMap.get(refId);
      const unitPrice = typeof movement.product.unitPrice === 'object' && 'toNumber' in movement.product.unitPrice
        ? (movement.product.unitPrice as any).toNumber()
        : Number(movement.product.unitPrice) || 0;
      const lineTotal = unitPrice * movement.qty;
      
      purchase.items.push({
        productId: movement.productId,
        productName: movement.product.name,
        product: movement.product,
        quantity: movement.qty,
        qty: movement.qty,
        price: unitPrice,
        unitPrice: unitPrice,
        subtotal: lineTotal,
        amount: lineTotal,
        total: lineTotal,
      });
      
      purchase.total += lineTotal;
    }

    return Array.from(purchaseMap.values());
  }
}


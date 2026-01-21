import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

interface AnalyticsFilters {
  from?: string;
  to?: string;
  region?: string;
  city?: string;
  storeId?: string;
  categoryId?: string;
  manufacturerId?: string;
  brandId?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private buildWhereClause(filters: AnalyticsFilters) {
    const where: any = {};

    if (filters.from || filters.to) {
      where.createdAt = {};
      const fromDate = filters.from ? new Date(filters.from) : null;
      if (fromDate && !isNaN(fromDate.getTime())) {
        where.createdAt.gte = fromDate;
      }
      const toRaw = filters.to ? new Date(filters.to) : null;
      if (toRaw && !isNaN(toRaw.getTime())) {
        const toEnd = new Date(toRaw);
        toEnd.setHours(23, 59, 59, 999);
        where.createdAt.lte = toEnd;
      }
    }

    if (filters.storeId) {
      where.storeId = filters.storeId;
    } else if (filters.region || filters.city) {
      where.store = {};
      if (filters.region) {
        where.store.region = filters.region;
      }
      if (filters.city) {
        where.store.city = filters.city;
      }
    }

    if (filters.categoryId || filters.manufacturerId || filters.brandId) {
      where.items = {
        some: {
          product: {},
        },
      };
      if (filters.categoryId) {
        where.items.some.product.categoryId = filters.categoryId;
      }
      if (filters.manufacturerId) {
        where.items.some.product.manufacturerId = filters.manufacturerId;
      }
      if (filters.brandId) {
        where.items.some.product.brandId = filters.brandId;
      }
    }

    return where;
  }

  async getSummary(filters: AnalyticsFilters) {
    const where = this.buildWhereClause(filters);

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        store: true,
      },
    });

    // Calculate metrics
    let salesValue = new Decimal(0);
    let salesVolume = 0;
    const productSales = new Map<string, { value: Decimal; volume: number }>();
    const storeSales = new Map<string, { value: Decimal; volume: number }>();

    for (const invoice of invoices) {
      salesValue = salesValue.add(invoice.totalAmount);
      salesVolume += invoice.totalItems;

      // Store-level aggregation
      const storeKey = invoice.storeId;
      if (!storeSales.has(storeKey)) {
        storeSales.set(storeKey, { value: new Decimal(0), volume: 0 });
      }
      const storeData = storeSales.get(storeKey)!;
      storeData.value = storeData.value.add(invoice.totalAmount);
      storeData.volume += invoice.totalItems;

      // Product-level aggregation
      for (const item of invoice.items) {
        const productKey = item.productId;
        if (!productSales.has(productKey)) {
          productSales.set(productKey, { value: new Decimal(0), volume: 0 });
        }
        const productData = productSales.get(productKey)!;
        productData.value = productData.value.add(item.lineTotal);
        productData.volume += item.qty;
      }
    }

    // Calculate distribution metrics (approximations for POC)
    // Distribution: % of stores that sold this product
    const totalStores = await this.prisma.store.count({
      where: filters.region
        ? { region: filters.region }
        : filters.city
          ? { city: filters.city }
          : {},
    });

    const storesWithSales = new Set(
      invoices.map((inv) => inv.storeId),
    ).size;

    // Weighted Distribution: % of sales volume from stores that sold this product
    // For POC, we approximate this as storesWithSales / totalStores
    const weightedDistribution =
      totalStores > 0 ? (storesWithSales / totalStores) * 100 : 0;

    // Share in shops: % of stores that have this product in inventory
    // For POC, we approximate this
    const productsInStores = await this.prisma.inventory.groupBy({
      by: ['productId'],
      where: filters.storeId
        ? { storeId: filters.storeId }
        : filters.region || filters.city
          ? {
              store: {
                ...(filters.region && { region: filters.region }),
                ...(filters.city && { city: filters.city }),
              },
            }
          : {},
      _count: {
        storeId: true,
      },
    });

    const avgShareInShops =
      productsInStores.length > 0
        ? productsInStores.reduce((sum, p) => sum + p._count.storeId, 0) /
          productsInStores.length /
          totalStores
        : 0;

    // Average price per litre
    const productsWithSize = await this.prisma.product.findMany({
      where: {
        unitSizeMl: { not: null },
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.manufacturerId && { manufacturerId: filters.manufacturerId }),
        ...(filters.brandId && { brandId: filters.brandId }),
      },
    });

    let totalPricePerLitre = new Decimal(0);
    let countWithSize = 0;

    for (const product of productsWithSize) {
      if (product.unitSizeMl && product.unitSizeMl > 0) {
        const pricePerLitre = new Decimal(product.unitPrice)
          .div(product.unitSizeMl)
          .mul(1000);
        totalPricePerLitre = totalPricePerLitre.add(pricePerLitre);
        countWithSize++;
      }
    }

    const avgPricePerLitre =
      countWithSize > 0 ? totalPricePerLitre.div(countWithSize).toString() : '0';

    // Average price per SKU
    const avgPricePerSKU =
      productSales.size > 0
        ? Array.from(productSales.values())
            .reduce((sum, p) => sum.add(p.value), new Decimal(0))
            .div(productSales.size)
            .toString()
        : '0';

    return {
      salesValue: salesValue.toString(),
      salesVolume,
      distribution: weightedDistribution, // Approximation
      weightedDistribution,
      shareInShops: avgShareInShops * 100,
      avgPricePerLitre,
      avgPricePerSKU,
      totalInvoices: invoices.length,
      implementedStores: storesWithSales,
      totalStores,
      trends: {
        salesValue: 0,
        salesVolume: 0,
        distribution: 0,
        weightedDistribution: 0,
        shareInShops: 0,
      },
    };
  }

  async getSalesTrend(filters: AnalyticsFilters & { bucket?: string }) {
    const where = this.buildWhereClause(filters);
    const bucket = filters.bucket || 'daily';

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date bucket
    const seriesMap = new Map<string, { salesValue: Decimal; salesVolume: number }>();

    for (const invoice of invoices) {
      const date = new Date(invoice.createdAt);
      let key: string;

      if (bucket === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!seriesMap.has(key)) {
        seriesMap.set(key, { salesValue: new Decimal(0), salesVolume: 0 });
      }

      const data = seriesMap.get(key)!;
      data.salesValue = data.salesValue.add(invoice.totalAmount);
      data.salesVolume += invoice.totalItems;
    }

    const series = Array.from(seriesMap.entries())
      .map(([date, data]) => ({
        date,
        salesValue: data.salesValue.toString(),
        salesVolume: data.salesVolume,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      bucket,
      series,
    };
  }

  async getBrandDistribution(filters: AnalyticsFilters) {
    const where = this.buildWhereClause(filters);

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
    });

    const brandMap = new Map<
      string,
      { brandName: string; salesValue: Decimal; salesVolume: number }
    >();

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const brandId = item.product.brandId;
        const brandName = item.product.brand.name;

        if (!brandMap.has(brandId)) {
          brandMap.set(brandId, {
            brandName,
            salesValue: new Decimal(0),
            salesVolume: 0,
          });
        }

        const brandData = brandMap.get(brandId)!;
        brandData.salesValue = brandData.salesValue.add(item.lineTotal);
        brandData.salesVolume += item.qty;
      }
    }

    const rows = Array.from(brandMap.entries()).map(([brandId, data]) => ({
      brandId,
      brandName: data.brandName,
      salesValue: data.salesValue.toString(),
      salesVolume: data.salesVolume,
    }));

    return { rows };
  }

  async getMarketShare(filters: AnalyticsFilters & { metric?: string }) {
    const metric = filters.metric || 'value';
    const where = this.buildWhereClause(filters);

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                manufacturer: true,
              },
            },
          },
        },
      },
    });

    const entityMap = new Map<string, { label: string; value: Decimal }>();

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const entityKey = filters.brandId
          ? `brand_${item.product.brandId}`
          : `manufacturer_${item.product.manufacturerId}`;
        const entityLabel = filters.brandId
          ? item.product.brand.name
          : item.product.manufacturer.name;

        if (!entityMap.has(entityKey)) {
          entityMap.set(entityKey, { label: entityLabel, value: new Decimal(0) });
        }

        const entityData = entityMap.get(entityKey)!;
        if (metric === 'volume') {
          entityData.value = entityData.value.add(item.qty);
        } else {
          entityData.value = entityData.value.add(item.lineTotal);
        }
      }
    }

    const total = Array.from(entityMap.values()).reduce(
      (sum, e) => sum.add(e.value),
      new Decimal(0),
    );

    const slices = Array.from(entityMap.values())
      .map((entity) => ({
        label: entity.label,
        value:
          total.gt(0)
            ? entity.value.div(total).mul(100).toNumber()
            : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      metric,
      slices,
    };
  }

  async getBrands(filters: AnalyticsFilters & { page?: string; pageSize?: string; sort?: string }) {
    const page = parseInt(filters.page || '1', 10);
    const pageSize = parseInt(filters.pageSize || '10', 10);
    const skip = (page - 1) * pageSize;

    const where = this.buildWhereClause(filters);

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
    });

    const brandMap = new Map<
      string,
      {
        brandName: string;
        salesValue: Decimal;
        salesVolume: number;
        totalQty: number;
        totalPrice: Decimal;
        unitSizeMl: number[];
      }
    >();

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const brandId = item.product.brandId;
        const brandName = item.product.brand.name;

        if (!brandMap.has(brandId)) {
          brandMap.set(brandId, {
            brandName,
            salesValue: new Decimal(0),
            salesVolume: 0,
            totalQty: 0,
            totalPrice: new Decimal(0),
            unitSizeMl: [],
          });
        }

        const brandData = brandMap.get(brandId)!;
        brandData.salesValue = brandData.salesValue.add(item.lineTotal);
        brandData.salesVolume += item.qty;
        brandData.totalQty += item.qty;
        brandData.totalPrice = brandData.totalPrice.add(item.lineTotal);
        if (item.product.unitSizeMl) {
          brandData.unitSizeMl.push(item.product.unitSizeMl);
        }
      }
    }

    let rows = Array.from(brandMap.entries()).map(([brandId, data]) => {
      const avgPrice = data.totalQty > 0 ? data.totalPrice.div(data.totalQty).toString() : '0';
      const avgSizeMl =
        data.unitSizeMl.length > 0
          ? data.unitSizeMl.reduce((sum, size) => sum + size, 0) / data.unitSizeMl.length
          : 0;
      const avgPricePerLitre =
        avgSizeMl > 0
          ? new Decimal(avgPrice).div(avgSizeMl).mul(1000).toString()
          : '0';

      return {
        brandId,
        brandName: data.brandName,
        salesValue: data.salesValue.toString(),
        shareValue: '0', // Would need total to calculate
        avgPrice,
        avgPricePerLitre,
      };
    });

    // Sort
    const sortField = filters.sort || 'salesValue';
    rows.sort((a, b) => {
      if (sortField === 'salesValue') {
        return new Decimal(b.salesValue).cmp(new Decimal(a.salesValue));
      }
      return 0;
    });

    // Paginate
    const total = rows.length;
    rows = rows.slice(skip, skip + pageSize);

    return {
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getTopSkus(filters: AnalyticsFilters & { limit?: string }) {
    const limit = parseInt(filters.limit || '10', 10);
    const where = this.buildWhereClause(filters);

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
    });

    const skuMap = new Map<
      string,
      {
        sku: string;
        name: string;
        brandName: string;
        salesValue: Decimal;
        salesVolume: number;
      }
    >();

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const sku = item.product.sku;

        if (!skuMap.has(sku)) {
          skuMap.set(sku, {
            sku,
            name: item.product.name,
            brandName: item.product.brand.name,
            salesValue: new Decimal(0),
            salesVolume: 0,
          });
        }

        const skuData = skuMap.get(sku)!;
        skuData.salesValue = skuData.salesValue.add(item.lineTotal);
        skuData.salesVolume += item.qty;
      }
    }

    const rows = Array.from(skuMap.values())
      .sort((a, b) => b.salesValue.cmp(a.salesValue))
      .slice(0, limit)
      .map((data) => ({
        sku: data.sku,
        name: data.name,
        brandName: data.brandName,
        salesValue: data.salesValue.toString(),
        salesVolume: data.salesVolume,
      }));

    return { rows };
  }
}


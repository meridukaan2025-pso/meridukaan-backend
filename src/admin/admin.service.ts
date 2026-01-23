import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getFilters() {
    const [regionRows, cityRows, stores, categories, manufacturers, brands] = await Promise.all([
      this.prisma.store.findMany({
        select: { region: true },
        distinct: ['region'],
      }),
      this.prisma.store.findMany({
        select: { city: true },
        distinct: ['city'],
      }),
      this.prisma.store.findMany({
        select: { id: true, name: true, region: true, city: true },
      }),
      this.prisma.category.findMany({
        select: { id: true, name: true, parentId: true },
      }),
      this.prisma.manufacturer.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.brand.findMany({
        include: {
          manufacturer: {
            select: { name: true },
          },
        },
      }),
    ]);

    const regionValues = regionRows.map((r) => r.region).filter((v): v is string => v != null && String(v).trim() !== '');
    const cityValues = cityRows.map((c) => c.city).filter((v): v is string => v != null && String(v).trim() !== '');

    return {
      regions: [...new Set(regionValues)].map((r) => ({ id: r, name: r })),
      cities: [...new Set(cityValues)].map((c) => ({ id: c, name: c })),
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        region: s.region,
        city: s.city,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
      })),
      manufacturers: manufacturers.map((m) => ({
        id: m.id,
        name: m.name,
      })),
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        manufacturerId: b.manufacturerId,
        manufacturerName: b.manufacturer.name,
      })),
    };
  }

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    });
    return categories;
  }

  async getBrands() {
    const brands = await this.prisma.brand.findMany({
      include: {
        manufacturer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return brands.map((b) => ({
      id: b.id,
      name: b.name,
      manufacturerId: b.manufacturerId,
      manufacturerName: b.manufacturer.name,
    }));
  }

  async getManufacturers() {
    const manufacturers = await this.prisma.manufacturer.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return manufacturers;
  }
}


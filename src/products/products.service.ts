import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QuickCreateProductDto } from './dto/quick-create-product.dto';
import { CreateProductAdminDto } from './dto/create-product-admin.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Helper: add unitPrice as number and stock (sum of inventory qtyOnHand)
  private transformProduct(product: any) {
    const stock = Array.isArray(product.inventory)
      ? product.inventory.reduce((s: number, i: { qtyOnHand: number }) => s + (i.qtyOnHand || 0), 0)
      : 0;
    const { inventory, ...rest } = product;
    return {
      ...rest,
      unitPrice: product.unitPrice?.toNumber?.() ?? product.unitPrice,
      stock,
    };
  }

  private transformProducts(products: any[]) {
    return products.map((p) => this.transformProduct(p));
  }

  async createFromAdmin(dto: CreateProductAdminDto) {
    // Validate storeId is provided
    if (!dto.storeId) throw new BadRequestException('storeId is required');
    
    // Check if product with same SKU already exists in this store
    const existing = await this.prisma.product.findFirst({ 
      where: { sku: dto.sku, storeId: dto.storeId } 
    });
    if (existing) throw new ConflictException(`Product with SKU ${dto.sku} already exists in this store`);
    
    if (!dto.categoryId && !dto.categoryName) throw new BadRequestException('Provide categoryId or categoryName');
    if (!dto.brandId && !dto.brandName) throw new BadRequestException('Provide brandId or brandName');
    if (dto.brandName && !dto.manufacturerId && !dto.manufacturerName) throw new BadRequestException('Provide manufacturerId or manufacturerName when using brandName');
    const sq = dto.stockQuantity ?? 0;

    const product = await this.prisma.$transaction(async (tx) => {
      let category: { id: string };
      if (dto.categoryId) {
        const c = await tx.category.findUnique({ where: { id: dto.categoryId } });
        if (!c) throw new NotFoundException('Category not found');
        category = c;
      } else {
        let c = await tx.category.findFirst({ where: { name: dto.categoryName! } });
        if (!c) c = await tx.category.create({ data: { name: dto.categoryName! } });
        category = c;
      }

      let manufacturer: { id: string } | null = null;
      if (dto.manufacturerId) {
        const m = await tx.manufacturer.findUnique({ where: { id: dto.manufacturerId } });
        if (!m) throw new NotFoundException('Manufacturer not found');
        manufacturer = m;
      } else if (dto.manufacturerName) {
        let m = await tx.manufacturer.findFirst({ where: { name: dto.manufacturerName } });
        if (!m) m = await tx.manufacturer.create({ data: { name: dto.manufacturerName } });
        manufacturer = m;
      }

      let brand: { id: string; manufacturerId: string };
      if (dto.brandId) {
        const b = await tx.brand.findUnique({ where: { id: dto.brandId } });
        if (!b) throw new NotFoundException('Brand not found');
        brand = b;
      } else {
        if (!manufacturer) throw new BadRequestException('manufacturerId or manufacturerName required when using brandName');
        let b = await tx.brand.findFirst({ where: { name: dto.brandName!, manufacturerId: manufacturer.id } });
        if (!b) b = await tx.brand.create({ data: { name: dto.brandName!, manufacturerId: manufacturer.id } });
        brand = b;
      }

      const newProduct = await tx.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          storeId: dto.storeId,
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: brand.manufacturerId,
          unitPrice: dto.unitPrice,
          unitSizeMl: dto.unitSizeMl,
          unitSizeValue: dto.unitSizeValue ?? (dto.unitSizeMl != null ? dto.unitSizeMl : undefined),
          unitSizeUnit: dto.unitSizeUnit ?? (dto.unitSizeMl != null ? 'ML' : undefined),
        },
        include: { category: true, brand: { include: { manufacturer: true } }, manufacturer: true },
      });

      if (sq > 0 && dto.storeId) {
        await tx.inventory.upsert({
          where: { storeId_productId: { storeId: dto.storeId, productId: newProduct.id } },
          create: { storeId: dto.storeId, productId: newProduct.id, qtyOnHand: sq },
          update: { qtyOnHand: { increment: sq } },
        });
      }
      return newProduct;
    });
    return this.transformProduct(product);
  }

  async create(createProductDto: CreateProductDto) {
    // Validate storeId is provided
    if (!createProductDto.storeId) {
      throw new BadRequestException('storeId is required');
    }
    
    // Check if product with same SKU already exists in this store
    const existingProduct = await this.prisma.product.findFirst({
      where: { 
        sku: createProductDto.sku,
        storeId: createProductDto.storeId,
      },
    });

    if (existingProduct) {
      throw new ConflictException(`Product with SKU ${createProductDto.sku} already exists in this store`);
    }

    // Validate category exists
    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${createProductDto.categoryId} not found`);
    }

    // Validate brand exists
    const brand = await this.prisma.brand.findUnique({
      where: { id: createProductDto.brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${createProductDto.brandId} not found`);
    }

    // Validate manufacturer exists
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id: createProductDto.manufacturerId },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Manufacturer with ID ${createProductDto.manufacturerId} not found`);
    }

    // Create product
    const product = await this.prisma.product.create({
      data: {
        sku: createProductDto.sku,
        name: createProductDto.name,
        storeId: createProductDto.storeId,
        categoryId: createProductDto.categoryId,
        brandId: createProductDto.brandId,
        manufacturerId: createProductDto.manufacturerId,
        unitPrice: createProductDto.unitPrice,
        unitSizeMl: createProductDto.unitSizeMl,
        unitSizeValue: createProductDto.unitSizeValue ?? (createProductDto.unitSizeMl != null ? createProductDto.unitSizeMl : undefined),
        unitSizeUnit: createProductDto.unitSizeUnit ?? (createProductDto.unitSizeMl != null ? 'ML' : undefined),
      },
      include: {
        category: true,
        brand: {
          include: {
            manufacturer: true,
          },
        },
        manufacturer: true,
      },
    });

    return this.transformProduct(product);
  }

  async quickCreate(quickCreateDto: QuickCreateProductDto, storeId: string) {
    // Check if SKU already exists in this store
    const existingProduct = await this.prisma.product.findFirst({
      where: { 
        sku: quickCreateDto.sku,
        storeId: storeId,
      },
    });

    if (existingProduct) {
      throw new ConflictException(`Product with SKU ${quickCreateDto.sku} already exists in this store`);
    }

    // Use transaction to ensure data consistency
    const product = await this.prisma.$transaction(async (tx) => {
      // Find or create manufacturer
      let manufacturer = await tx.manufacturer.findUnique({
        where: { name: quickCreateDto.manufacturerName },
      });

      if (!manufacturer) {
        manufacturer = await tx.manufacturer.create({
          data: { name: quickCreateDto.manufacturerName },
        });
      }

      // Find or create brand (with manufacturer)
      let brand = await tx.brand.findFirst({
        where: {
          name: quickCreateDto.brandName,
          manufacturerId: manufacturer.id,
        },
      });

      if (!brand) {
        brand = await tx.brand.create({
          data: {
            name: quickCreateDto.brandName,
            manufacturerId: manufacturer.id,
          },
        });
      }

      // Find or create category (use root category if not found)
      let category = await tx.category.findFirst({
        where: { name: quickCreateDto.categoryName },
      });

      if (!category) {
        category = await tx.category.create({
          data: { name: quickCreateDto.categoryName },
        });
      }

      // Create product
      const newProduct = await tx.product.create({
        data: {
          sku: quickCreateDto.sku,
          name: quickCreateDto.name,
          storeId: storeId,
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          unitPrice: quickCreateDto.unitPrice,
          unitSizeMl: quickCreateDto.unitSizeMl,
          unitSizeValue: quickCreateDto.unitSizeValue ?? (quickCreateDto.unitSizeMl != null ? quickCreateDto.unitSizeMl : undefined),
          unitSizeUnit: quickCreateDto.unitSizeUnit ?? (quickCreateDto.unitSizeMl != null ? 'ML' : undefined),
        },
        include: {
          category: true,
          brand: {
            include: {
              manufacturer: true,
            },
          },
          manufacturer: true,
        },
      });

      // Initialize inventory for this store (stockQuantity is required)
      const initialQty = quickCreateDto.stockQuantity;
      await tx.inventory.upsert({
        where: {
          storeId_productId: {
            storeId,
            productId: newProduct.id,
          },
        },
        create: {
          storeId,
          productId: newProduct.id,
          qtyOnHand: initialQty,
        },
        update: {
          // If exists, don't change qty
        },
      });

      return newProduct;
    });

    return this.transformProduct(product);
  }

  async findBySku(sku: string, storeId?: string) {
    const where: any = { sku };
    if (storeId) {
      where.storeId = storeId;
    }
    
    const product = await this.prisma.product.findFirst({
      where,
      include: {
        category: true,
        brand: { include: { manufacturer: true } },
        manufacturer: true,
        inventory: { select: { qtyOnHand: true } },
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku}${storeId ? ' in this store' : ''} not found`);
    }
    return this.transformProduct(product);
  }

  async findAll(storeId?: string) {
    const where: any = {};
    if (storeId) {
      where.storeId = storeId;
    }
    
    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: { include: { manufacturer: true } },
        manufacturer: true,
        inventory: { select: { qtyOnHand: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.transformProducts(products);
  }

  async findById(id: string, storeId?: string) {
    const where: any = { id };
    if (storeId) {
      where.storeId = storeId;
    }
    
    const product = await this.prisma.product.findFirst({
      where,
      include: {
        category: true,
        brand: { include: { manufacturer: true } },
        manufacturer: true,
        inventory: { select: { qtyOnHand: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.transformProduct(product);
  }

  async update(id: string, dto: UpdateProductDto, storeId?: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    // Verify product belongs to user's store (if storeId provided)
    if (storeId && existing.storeId !== storeId) {
      throw new BadRequestException('Product does not belong to your store');
    }

    if (dto.sku && dto.sku !== existing.sku) {
      const where: any = { sku: dto.sku };
      if (storeId) {
        where.storeId = storeId;
      } else if (existing.storeId) {
        where.storeId = existing.storeId;
      }
      const taken = await this.prisma.product.findFirst({ where });
      if (taken) throw new ConflictException(`Product with SKU ${dto.sku} already exists in this store`);
    }
    if (dto.categoryId) {
      const c = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!c) throw new NotFoundException('Category not found');
    }
    if (dto.brandId) {
      const b = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
      if (!b) throw new NotFoundException('Brand not found');
    }
    if (dto.manufacturerId) {
      const m = await this.prisma.manufacturer.findUnique({ where: { id: dto.manufacturerId } });
      if (!m) throw new NotFoundException('Manufacturer not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.sku != null) data.sku = dto.sku;
    if (dto.name != null) data.name = dto.name;
    if (dto.categoryId != null) data.categoryId = dto.categoryId;
    if (dto.brandId != null) data.brandId = dto.brandId;
    if (dto.manufacturerId != null) data.manufacturerId = dto.manufacturerId;
    if (dto.unitPrice != null) data.unitPrice = dto.unitPrice;
    if (dto.unitSizeMl != null) {
      data.unitSizeMl = dto.unitSizeMl;
      // Backward compat: if only unitSizeMl is supplied, map to new generic fields
      if (dto.unitSizeValue == null) data.unitSizeValue = dto.unitSizeMl;
      if (dto.unitSizeUnit == null) data.unitSizeUnit = 'ML';
    }
    if (dto.unitSizeValue != null) data.unitSizeValue = dto.unitSizeValue;
    if (dto.unitSizeUnit != null) data.unitSizeUnit = dto.unitSizeUnit;

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        brand: { include: { manufacturer: true } },
        manufacturer: true,
        inventory: { select: { qtyOnHand: true } },
      },
    });
    return this.transformProduct(product);
  }

  async addStock(productId: string, storeId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const inv = await this.prisma.inventory.findUnique({
      where: { storeId_productId: { storeId, productId } },
    });
    const current = inv?.qtyOnHand ?? 0;
    const after = current + quantity;
    if (after < 0) throw new BadRequestException(`Cannot reduce stock by ${quantity}; current at store: ${current}`);

    await this.prisma.inventory.upsert({
      where: { storeId_productId: { storeId, productId } },
      create: { storeId, productId, qtyOnHand: after },
      update: { qtyOnHand: after },
    });
    return { storeId, productId, previousQty: current, added: quantity, newQty: after };
  }

  async remove(id: string, storeId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { invoiceItems: true } } },
    });
    if (!existing) throw new NotFoundException('Product not found');
    
    // Verify product belongs to user's store (if storeId provided)
    if (storeId && existing.storeId !== storeId) {
      throw new BadRequestException('Product does not belong to your store');
    }
    
    if (existing._count.invoiceItems > 0) {
      throw new BadRequestException('Cannot delete product that has been used in invoices.');
    }

    await this.prisma.inventoryMovement.deleteMany({ where: { productId: id } });
    await this.prisma.inventory.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Product deleted successfully' };
  }
}

import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QuickCreateProductDto } from './dto/quick-create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Helper function to transform product unitPrice from Decimal to number
  // Converting to number for frontend calculations (Decimal(10,2) ensures precision)
  private transformProduct(product: any) {
    return {
      ...product,
      unitPrice: product.unitPrice.toNumber(),
    };
  }

  // Helper function to transform array of products
  private transformProducts(products: any[]) {
    return products.map(product => this.transformProduct(product));
  }

  async create(createProductDto: CreateProductDto) {
    // Check if SKU already exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { sku: createProductDto.sku },
    });

    if (existingProduct) {
      throw new ConflictException(`Product with SKU ${createProductDto.sku} already exists`);
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
        categoryId: createProductDto.categoryId,
        brandId: createProductDto.brandId,
        manufacturerId: createProductDto.manufacturerId,
        unitPrice: createProductDto.unitPrice,
        unitSizeMl: createProductDto.unitSizeMl,
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
    // Check if SKU already exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { sku: quickCreateDto.sku },
    });

    if (existingProduct) {
      throw new ConflictException(`Product with SKU ${quickCreateDto.sku} already exists`);
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
          categoryId: category.id,
          brandId: brand.id,
          manufacturerId: manufacturer.id,
          unitPrice: quickCreateDto.unitPrice,
          unitSizeMl: quickCreateDto.unitSizeMl,
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

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
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

    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku} not found`);
    }

    return this.transformProduct(product);
  }

  async findAll() {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        brand: {
          include: {
            manufacturer: true,
          },
        },
        manufacturer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return this.transformProducts(products);
  }
}

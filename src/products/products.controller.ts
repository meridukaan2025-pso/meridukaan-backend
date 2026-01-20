import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QuickCreateProductDto } from './dto/quick-create-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Products')
@ApiBearerAuth('JWT-auth')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({
    summary: 'Create product',
    description: 'Create a new product with full details. Requires ADMIN, INVENTORY, or PURCHASE role. All category, brand, and manufacturer IDs must exist.',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        sku: { type: 'string', example: 'PRODUCT-001' },
        name: { type: 'string', example: 'Product Name' },
        unitPrice: { type: 'number', example: 50.00 },
        unitSizeMl: { type: 'number', example: 500, nullable: true },
        category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        brand: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            manufacturer: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
        manufacturer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input' })
  @ApiResponse({ status: 404, description: 'Category, Brand, or Manufacturer not found' })
  @ApiResponse({ status: 409, description: 'Product with this SKU already exists' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('quick-create')
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Quick create product (POS)',
    description: 'Quickly create a product when barcode doesn\'t match. Automatically creates category, brand, and manufacturer if they don\'t exist. Requires SALES or ADMIN role. Use this when scanning an unknown barcode - SKU will be pre-filled from scan error.',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully. Product ID is returned immediately for use in invoice creation.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c', description: 'Use this product ID in invoice creation' },
        sku: { type: 'string', example: 'NEW-PRODUCT-001' },
        name: { type: 'string', example: 'New Product Name' },
        unitPrice: { type: 'number', example: 50.00 },
        unitSizeMl: { type: 'number', example: 500, nullable: true },
        category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Soft Drinks' },
          },
        },
        brand: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'New Brand' },
            manufacturer: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string', example: 'New Manufacturer' },
              },
            },
          },
        },
        manufacturer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'New Manufacturer' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input or user not assigned to store' })
  @ApiResponse({ status: 409, description: 'Product with this SKU already exists' })
  async quickCreate(
    @Body() quickCreateDto: QuickCreateProductDto,
    @CurrentUser() user: any,
  ) {
    // Get storeId from user (required for inventory initialization)
    if (!user.storeId) {
      throw new Error('User must be assigned to a store to create products');
    }

    return this.productsService.quickCreate(quickCreateDto, user.storeId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE, UserRole.SALES)
  @ApiOperation({
    summary: 'Get all products',
    description: 'Retrieve a list of all products with their category, brand, and manufacturer details. Requires ADMIN, INVENTORY, PURCHASE, or SALES role.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of products retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
          sku: { type: 'string', example: 'COKE-330ML' },
          name: { type: 'string', example: 'Coca-Cola 330ml' },
          unitPrice: { type: 'number', example: 35.00 },
          unitSizeMl: { type: 'number', example: 330, nullable: true },
          category: { type: 'object' },
          brand: { type: 'object' },
          manufacturer: { type: 'object' },
        },
      },
    },
  })
  async findAll() {
    return this.productsService.findAll();
  }

  @Get('sku/:sku')
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({
    summary: 'Get product by SKU',
    description: 'Retrieve a product by its SKU (barcode). Accessible by all authenticated users. Use this to verify if a product exists before scanning.',
  })
  @ApiParam({ name: 'sku', description: 'Product SKU (barcode)', example: 'COKE-330ML' })
  @ApiResponse({
    status: 200,
    description: 'Product found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        sku: { type: 'string', example: 'COKE-330ML' },
        name: { type: 'string', example: 'Coca-Cola 330ml' },
        unitPrice: { type: 'number', example: 35.00 },
        unitSizeMl: { type: 'number', example: 330, nullable: true },
        category: { type: 'object' },
        brand: { type: 'object' },
        manufacturer: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }
}

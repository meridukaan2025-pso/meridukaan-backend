import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductAdminDto } from './dto/create-product-admin.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QuickCreateProductDto } from './dto/quick-create-product.dto';
import { AddStockDto } from './dto/add-stock.dto';
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
    description: 'Create a new product with full details. Requires ADMIN, INVENTORY, or PURCHASE role. \n\n**Note:** This endpoint requires IDs (UUIDs) for category, brand, manufacturer, and store. To get these IDs:\n- `GET /admin/categories` - Get all categories with IDs\n- `GET /admin/brands` - Get all brands with IDs\n- `GET /admin/manufacturers` - Get all manufacturers with IDs\n- `GET /stores` - Get all stores with IDs (public endpoint)\n- `GET /admin/filters` - Get all of the above in one call\n\n**Alternative:** Use `POST /products/admin-create` if you want to create products using names instead of IDs (recommended).\n\nAll IDs must exist in the database. storeId is required - product belongs to a specific store.',
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
        storeId: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        unitPrice: { type: 'number', example: 50.00 },
        unitSizeMl: { type: 'number', example: 500, nullable: true, description: 'DEPRECATED: Use unitSizeValue + unitSizeUnit' },
        unitSizeValue: { type: 'number', example: 500, nullable: true },
        unitSizeUnit: { type: 'string', example: 'ML', enum: ['ML', 'L', 'G', 'KG', 'PCS'], nullable: true },
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
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input (e.g., missing storeId, invalid IDs)' })
  @ApiResponse({ status: 404, description: 'Category, Brand, Manufacturer, or Store not found' })
  @ApiResponse({ status: 409, description: 'Product with this SKU already exists in this store' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Post('admin-create')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({
    summary: 'Create product (admin) - Recommended',
    description: 'Create product with flexible options. **This is the recommended endpoint** because:\n\n- You can use **names** instead of IDs for category, brand, and manufacturer (they will be created if they don\'t exist)\n- You can use either `categoryId` OR `categoryName` (same for brand/manufacturer)\n- You can optionally add initial stock\n- **storeId is required** - product must belong to a store\n\n**Example:** Use `categoryName: "Beverages"` instead of `categoryId: "uuid-here"`',
  })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 400, description: 'Invalid input: e.g. need categoryId or categoryName; storeId when stockQuantity>0' })
  async createFromAdmin(@Body() dto: CreateProductAdminDto) {
    return this.productsService.createFromAdmin(dto);
  }

  @Post('quick-create')
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Quick create product (POS)',
    description: 'Quickly create a product when barcode doesn\'t match. Automatically creates category, brand, and manufacturer if they don\'t exist. Requires SALES or ADMIN role. storeId is automatically set from user\'s assigned store. Use this when scanning an unknown barcode - SKU will be pre-filled from scan error.',
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
        storeId: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c', description: 'Auto-assigned from user\'s store' },
        unitPrice: { type: 'number', example: 50.00 },
        unitSizeMl: { type: 'number', example: 500, nullable: true, description: 'DEPRECATED: Use unitSizeValue + unitSizeUnit' },
        unitSizeValue: { type: 'number', example: 500, nullable: true },
        unitSizeUnit: { type: 'string', example: 'ML', enum: ['ML', 'L', 'G', 'KG', 'PCS'], nullable: true },
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
    description: 'Retrieve a list of products. SALES users see only their store\'s products. ADMIN/INVENTORY/PURCHASE can filter by storeId query parameter.',
  })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Store ID (optional for ADMIN/INVENTORY/PURCHASE, auto-set for SALES)' })
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
  async findAll(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    let targetStoreId: string | undefined;

    if (user.role === UserRole.SALES) {
      // SALES users must use their assigned store
      if (!user.storeId) {
        throw new BadRequestException('User is not assigned to a store. Please contact administrator.');
      }
      targetStoreId = user.storeId;
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.INVENTORY || user.role === UserRole.PURCHASE) {
      // ADMIN/INVENTORY/PURCHASE can specify storeId or use their assigned store
      if (storeId) {
        targetStoreId = storeId;
      } else if (user.storeId) {
        targetStoreId = user.storeId;
      }
      // If no storeId specified, show all products (for ADMIN)
    }

    return this.productsService.findAll(targetStoreId);
  }

  @Get('sku/:sku')
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({
    summary: 'Get product by SKU',
    description: 'Retrieve a product by its SKU (barcode). SALES users see only products from their store. ADMIN/INVENTORY/PURCHASE can use storeId query parameter.',
  })
  @ApiParam({ name: 'sku', description: 'Product SKU (barcode)', example: 'COKE-330ML' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Store ID (optional for ADMIN/INVENTORY/PURCHASE, auto-set for SALES)' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findBySku(@Param('sku') sku: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    let targetStoreId: string | undefined;

    if (user.role === UserRole.SALES) {
      if (!user.storeId) {
        throw new BadRequestException('User is not assigned to a store. Please contact administrator.');
      }
      targetStoreId = user.storeId;
    } else if (storeId) {
      targetStoreId = storeId;
    } else if (user.storeId) {
      targetStoreId = user.storeId;
    }

    return this.productsService.findBySku(sku, targetStoreId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE, UserRole.SALES)
  @ApiOperation({ 
    summary: 'Get product by ID',
    description: 'Retrieve a product by ID. SALES users can only access products from their store.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const storeId = user.role === UserRole.SALES ? user.storeId : undefined;
    return this.productsService.findById(id, storeId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({ 
    summary: 'Update product',
    description: 'Update a product. INVENTORY/PURCHASE users can only update products from their assigned store.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Product does not belong to your store' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: any) {
    const storeId = (user.role === UserRole.INVENTORY || user.role === UserRole.PURCHASE) ? user.storeId : undefined;
    return this.productsService.update(id, dto, storeId);
  }

  @Post(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({ summary: 'Add or reduce stock', description: 'Adjust stock at a store. quantity: positive to add, negative to reduce.' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Stock updated' })
  @ApiResponse({ status: 400, description: 'Would result in negative stock' })
  @ApiResponse({ status: 404, description: 'Product or store not found' })
  async addStock(@Param('id') id: string, @Body() dto: AddStockDto) {
    return this.productsService.addStock(id, dto.storeId, dto.quantity);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY)
  @ApiOperation({ 
    summary: 'Delete product',
    description: 'Delete a product. INVENTORY users can only delete products from their assigned store.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete: product has been used in invoices or does not belong to your store' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const storeId = user.role === UserRole.INVENTORY ? user.storeId : undefined;
    return this.productsService.remove(id, storeId);
  }
}

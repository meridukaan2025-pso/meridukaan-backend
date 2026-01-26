import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('filters')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE, UserRole.SALES)
  @ApiOperation({ 
    summary: 'Get filter options', 
    description: 'Get all available filter options (stores, regions, cities, categories, brands, manufacturers) with their IDs. Use this to get IDs needed for product creation.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Filter options with IDs',
    schema: {
      type: 'object',
      properties: {
        stores: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
        categories: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
        brands: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
        manufacturers: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFilters() {
    return this.adminService.getFilters();
  }

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE, UserRole.SALES)
  @ApiOperation({ 
    summary: 'Get all categories', 
    description: 'Get list of all categories with their IDs. Use these IDs when creating products via POST /products endpoint.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of categories',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
          name: { type: 'string', example: 'Beverages' },
          parentId: { type: 'string', nullable: true, example: null },
        }
      }
    }
  })
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Get('brands')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE, UserRole.SALES)
  @ApiOperation({ 
    summary: 'Get all brands', 
    description: 'Get list of all brands with their IDs and manufacturer info. Use these IDs when creating products via POST /products endpoint.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of brands',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
          name: { type: 'string', example: 'Coca-Cola' },
          manufacturerId: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
          manufacturerName: { type: 'string', example: 'The Coca-Cola Company' },
        }
      }
    }
  })
  async getBrands() {
    return this.adminService.getBrands();
  }

  @Get('manufacturers')
  @Roles(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE, UserRole.SALES)
  @ApiOperation({ 
    summary: 'Get all manufacturers', 
    description: 'Get list of all manufacturers with their IDs. Use these IDs when creating products via POST /products endpoint.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of manufacturers',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
          name: { type: 'string', example: 'The Coca-Cola Company' },
        }
      }
    }
  })
  async getManufacturers() {
    return this.adminService.getManufacturers();
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.INVENTORY, UserRole.PURCHASE)
  @ApiOperation({ 
    summary: 'Get comprehensive dashboard summary', 
    description: 'Get all totals in one call: sales (total/today), purchases (total/today), inventory (value/items/low stock). No need to fetch individual records.' 
  })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store ID (optional)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Comprehensive summary with sales, purchases, and inventory totals',
    schema: {
      type: 'object',
      properties: {
        sales: {
          type: 'object',
          properties: {
            totalAmount: { type: 'number' },
            totalCount: { type: 'number' },
            totalItems: { type: 'number' },
            todayAmount: { type: 'number' },
            todayCount: { type: 'number' },
            todayItems: { type: 'number' },
          }
        },
        purchases: {
          type: 'object',
          properties: {
            totalAmount: { type: 'number' },
            totalCount: { type: 'number' },
            totalItems: { type: 'number' },
            todayAmount: { type: 'number' },
            todayCount: { type: 'number' },
            todayItems: { type: 'number' },
          }
        },
        inventory: {
          type: 'object',
          properties: {
            totalValue: { type: 'number' },
            totalItems: { type: 'number' },
            lowStockCount: { type: 'number' },
            uniqueProducts: { type: 'number' },
          }
        }
      }
    }
  })
  async getDashboardSummary(@Query('storeId') storeId?: string) {
    return this.analyticsService.getDashboardSummary(storeId);
  }

  @Get('analytics/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get dashboard summary', description: 'Get summary metrics for admin dashboard (total sales, invoices, AOV, etc.)' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store ID' })
  @ApiResponse({ status: 200, description: 'Summary metrics' })
  async getSummary(@Query() query: any) {
    return this.analyticsService.getSummary(query);
  }

  @Get('analytics/sales-trend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get sales trend', 
    description: 'Get sales trends over time with optional filters (date range, store, region, city). All query parameters are optional.' 
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store ID' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city' })
  @ApiResponse({ status: 200, description: 'Sales trend data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSalesTrend(@Query() query: any) {
    return this.analyticsService.getSalesTrend(query);
  }

  @Get('analytics/brand-distribution')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get brand distribution', 
    description: 'Get brand performance and distribution metrics with optional filters (date range, brand, category, manufacturer). All query parameters are optional.' 
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'brandId', required: false, type: String, description: 'Filter by brand ID' })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filter by category ID' })
  @ApiQuery({ name: 'manufacturerId', required: false, type: String, description: 'Filter by manufacturer ID' })
  @ApiResponse({ status: 200, description: 'Brand distribution data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBrandDistribution(@Query() query: any) {
    return this.analyticsService.getBrandDistribution(query);
  }

  @Get('analytics/market-share')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get market share analysis', 
    description: 'Get market share analysis with optional filters (date range, region, city, brand). All query parameters are optional.' 
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city' })
  @ApiQuery({ name: 'brandId', required: false, type: String, description: 'Filter by brand ID' })
  @ApiResponse({ status: 200, description: 'Market share data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMarketShare(@Query() query: any) {
    return this.analyticsService.getMarketShare(query);
  }

  @Get('analytics/brands')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get brand analytics', 
    description: 'Get brand analytics with optional filters (date range, category, manufacturer). All query parameters are optional.' 
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filter by category ID' })
  @ApiQuery({ name: 'manufacturerId', required: false, type: String, description: 'Filter by manufacturer ID' })
  @ApiResponse({ status: 200, description: 'Brand analytics data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBrandsAnalytics(@Query() query: any) {
    return this.analyticsService.getBrands(query);
  }

  @Get('analytics/top-skus')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get top selling SKUs', 
    description: 'Get top selling products (SKUs) with optional filters (date range, store, region, city). All query parameters are optional.' 
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store ID' })
  @ApiQuery({ name: 'region', required: false, type: String, description: 'Filter by region' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city' })
  @ApiResponse({ status: 200, description: 'Top SKUs data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTopSkus(@Query() query: any) {
    return this.analyticsService.getTopSkus(query);
  }
}


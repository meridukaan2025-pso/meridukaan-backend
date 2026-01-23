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
  async getSalesTrend(@Query() query: any) {
    return this.analyticsService.getSalesTrend(query);
  }

  @Get('analytics/brand-distribution')
  @Roles(UserRole.ADMIN)
  async getBrandDistribution(@Query() query: any) {
    return this.analyticsService.getBrandDistribution(query);
  }

  @Get('analytics/market-share')
  @Roles(UserRole.ADMIN)
  async getMarketShare(@Query() query: any) {
    return this.analyticsService.getMarketShare(query);
  }

  @Get('analytics/brands')
  @Roles(UserRole.ADMIN)
  async getBrandsAnalytics(@Query() query: any) {
    return this.analyticsService.getBrands(query);
  }

  @Get('analytics/top-skus')
  @Roles(UserRole.ADMIN)
  async getTopSkus(@Query() query: any) {
    return this.analyticsService.getTopSkus(query);
  }
}


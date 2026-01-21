import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Res,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { PosService } from './pos.service';
import { ScanDto } from './dto/scan.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('POS')
@ApiBearerAuth('JWT-auth')
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Scan product QR code', 
    description: 'Scan QR code (SKU) and get product details with available stock. Store ID is automatically taken from your assigned store (SALES users) or can be specified (ADMIN users). Use the product.id from the response when creating invoices.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Product found',
    schema: {
      type: 'object',
      properties: {
        product: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '42ad2ddc-3bae-4dcb-8950-66c3aa31cf3d', description: 'Use this product ID in invoice creation' },
            sku: { type: 'string', example: 'COKE-330ML' },
            name: { type: 'string', example: 'Coca-Cola 330ml' },
            unitPrice: { type: 'number', example: 35.00 },
            unitSizeMl: { type: 'number', example: 330, nullable: true },
            category: { type: 'string', example: 'Soft Drinks' },
            brand: { type: 'string', example: 'Coca-Cola' },
            manufacturer: { type: 'string', example: 'The Coca-Cola Company' },
          },
        },
        stockQty: { type: 'number', example: 100, description: 'Available stock quantity' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request or user not assigned to a store',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'User is not assigned to a store' },
      },
    },
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Product not found - use POST /products/quick-create to add this product',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Product with SKU COKE-330ML not found' },
        sku: { type: 'string', example: 'COKE-330ML', description: 'Scanned SKU/barcode' },
        suggestion: { type: 'string', example: 'Use POST /products/quick-create to add this product manually' },
        endpoint: { type: 'string', example: '/products/quick-create' },
      },
    },
  })
  async scan(@Body() scanDto: ScanDto, @CurrentUser() user: any) {
    // Determine storeId based on user role
    let storeId: string;
    
    if (user.role === UserRole.SALES) {
      // SALES users must use their assigned store
      if (!user.storeId) {
        throw new BadRequestException('User is not assigned to a store. Please contact administrator.');
      }
      storeId = user.storeId;
    } else if (user.role === UserRole.ADMIN) {
      // ADMIN can use their assigned store if they have one
      // For now, ADMIN must have a storeId assigned (can be updated later to allow store selection)
      if (!user.storeId) {
        throw new BadRequestException('Store ID is required. ADMIN users must be assigned to a store or specify storeId.');
      }
      storeId = user.storeId;
    } else {
      throw new BadRequestException('Unauthorized: Only SALES and ADMIN users can scan products.');
    }
    
    return this.posService.scanProduct(storeId, scanDto.qrValue);
  }

  @Post('invoices')
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Optional: Unique key to prevent duplicate invoices',
    required: false,
  })
  @ApiOperation({ 
    summary: 'Create invoice', 
    description: 'Create a new invoice with items. Store ID and Worker ID are automatically set.' 
  })
  @ApiBody({
    description: 'Invoice creation request',
    examples: {
      'Example Request': {
        value: {
          items: [
            {
              productId: '42ad2ddc-3bae-4dcb-8950-66c3aa31cf3d',
              qty: 5
            }
          ],
          clientInvoiceRef: 'INV-2026-001'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Invoice created successfully',
    schema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', example: 'invoice-uuid-123' },
        pdfUrl: { type: 'string', example: '/storage/invoices/invoice-uuid-123.pdf', nullable: true },
        totals: {
          type: 'object',
          properties: {
            amount: { type: 'string', example: '175.00' },
            items: { type: 'number', example: 5 },
          },
        },
        createdAt: { type: 'string', example: '2026-01-19T18:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request, insufficient stock, or product not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { 
          type: 'string', 
          example: 'One or more products not found. Missing product IDs: 7f952abc-5a32-4c47-b6c6-d4316bea9507',
          description: 'Error message indicating which product IDs are missing or stock issues. Example: "One or more products not found. Missing product IDs: 7f952abc-5a32-4c47-b6c6-d4316bea9507" or "Insufficient stock for product COKE-330ML. Available: 5, Requested: 10"',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async createInvoice(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: any,
  ) {
    // Determine storeId: use user's assigned store for SALES, or allow ADMIN to specify
    let storeId: string;
    
    if (user.role === UserRole.SALES) {
      // SALES users must use their assigned store
      if (!user.storeId) {
        throw new BadRequestException('User is not assigned to a store. Please contact administrator.');
      }
      storeId = user.storeId;
      
      // If storeId is provided in request, validate it matches user's store
      if (createInvoiceDto.storeId && createInvoiceDto.storeId !== user.storeId) {
        throw new BadRequestException('SALES users can only create invoices for their assigned store.');
      }
    } else if (user.role === UserRole.ADMIN) {
      // ADMIN can specify storeId or use their assigned store if they have one
      if (createInvoiceDto.storeId) {
        storeId = createInvoiceDto.storeId;
      } else if (user.storeId) {
        storeId = user.storeId;
      } else {
        throw new BadRequestException('Store ID is required. Please specify storeId in the request.');
      }
    } else {
      throw new BadRequestException('Unauthorized: Only SALES and ADMIN users can create invoices.');
    }

    // Worker ID is always the current user
    const workerId = user.id;

    // Create invoice DTO with determined values
    const invoiceData = {
      ...createInvoiceDto,
      storeId,
      workerId,
    };

    return this.posService.createInvoice(invoiceData, idempotencyKey);
  }

  @Get('invoices')
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.INVENTORY)
  @ApiOperation({ 
    summary: 'Get all invoices', 
    description: 'Retrieve list of all invoices with optional filters. Includes items and product details.' 
  })
  @ApiQuery({ name: 'storeId', required: false, type: String, description: 'Filter by store ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Filter from date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Filter to date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async getAllInvoices(@Query() query: any) {
    const filters: any = {};
    if (query.storeId) filters.storeId = query.storeId;
    const from = query.dateFrom ? new Date(query.dateFrom) : null;
    if (from && !isNaN(from.getTime())) filters.from = from;
    const toRaw = query.dateTo ? new Date(query.dateTo) : null;
    if (toRaw && !isNaN(toRaw.getTime())) {
      filters.to = new Date(toRaw);
      filters.to.setHours(23, 59, 59, 999);
    }
    return this.posService.getAllInvoices(filters);
  }

  @Get('invoices/:id')
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.INVENTORY)
  @ApiOperation({ summary: 'Get invoice details', description: 'Retrieve full invoice details including all items' })
  @ApiParam({ name: 'id', description: 'Invoice ID', type: String })
  @ApiResponse({ status: 200, description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Param('id') id: string) {
    return this.posService.getInvoice(id);
  }

  @Delete('invoices/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete (void) invoice', description: 'Delete an invoice and restore stock. ADMIN only.' })
  @ApiParam({ name: 'id', description: 'Invoice ID', type: String })
  @ApiResponse({ status: 200, description: 'Invoice deleted' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async deleteInvoice(@Param('id') id: string) {
    return this.posService.deleteInvoice(id);
  }

  @Get('invoices/:id/pdf')
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.INVENTORY)
  @ApiOperation({ summary: 'Get invoice PDF', description: 'Download invoice PDF file' })
  @ApiParam({ name: 'id', description: 'Invoice ID', type: String })
  @ApiResponse({ status: 200, description: 'PDF file', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 404, description: 'PDF not found' })
  async getInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.posService.getInvoice(id);
    
    if (!invoice.pdfUrl) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'PDF not found' });
    }

    const filePath = path.join(process.cwd(), invoice.pdfUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}


import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Res,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader, ApiBody } from '@nestjs/swagger';
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
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Scan product QR code', 
    description: 'Scan QR code (SKU) and get product details with available stock. Store ID is automatically taken from your assigned store (SALES users) or can be specified (ADMIN users).' 
  })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 400, description: 'Invalid request or user not assigned to a store' })
  @ApiResponse({ status: 404, description: 'Product not found' })
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
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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

  @Get('invoices/:id')
  @Roles(UserRole.SALES, UserRole.ADMIN, UserRole.INVENTORY)
  @ApiOperation({ summary: 'Get invoice details', description: 'Retrieve full invoice details including all items' })
  @ApiParam({ name: 'id', description: 'Invoice ID', type: String })
  @ApiResponse({ status: 200, description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Param('id') id: string) {
    return this.posService.getInvoice(id);
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


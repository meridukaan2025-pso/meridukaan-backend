import { IsArray, IsInt, IsOptional, IsString, IsNumber, Min, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncInvoiceItemDto {
  @ApiPropertyOptional({
    example: 'PROD-001',
    description: 'Product SKU (optional if productName provided)',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    example: 'Coca Cola',
    description: 'Product name (required if sku not provided)',
  })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty({
    example: 'Beverages',
    description: 'Category name (will be created if doesn\'t exist)',
  })
  @IsString()
  categoryName: string;

  @ApiProperty({
    example: 'Coca-Cola',
    description: 'Brand name (will be created if doesn\'t exist)',
  })
  @IsString()
  brandName: string;

  @ApiProperty({
    example: 'The Coca-Cola Company',
    description: 'Manufacturer name (will be created if doesn\'t exist)',
  })
  @IsString()
  manufacturerName: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiProperty({
    example: 50.00,
    description: 'Unit price',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    example: 10,
    description: 'Stock quantity to add when syncing (should be >= qty)',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  stockQuantity: number;
}

export class SyncInvoiceDto {
  @ApiProperty({
    example: 'local-uuid-123',
    description: 'Local invoice ID from frontend (temporary ID)',
  })
  @IsString()
  localId: string;

  @ApiProperty({
    type: [SyncInvoiceItemDto],
    description: 'Array of invoice items with product details',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncInvoiceItemDto)
  items: SyncInvoiceItemDto[];

  @ApiPropertyOptional({
    example: 'INV-2026-001',
    description: 'Client invoice reference',
  })
  @IsOptional()
  @IsString()
  clientInvoiceRef?: string;

  @ApiPropertyOptional({
    example: 'Cash',
    description: 'Payment method',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({
    example: '2026-01-24T10:00:00Z',
    description: 'Original creation timestamp (ISO string)',
  })
  @IsDateString()
  createdAt: string;
}

export class SyncInvoicesDto {
  @ApiProperty({
    type: [SyncInvoiceDto],
    description: 'Array of offline invoices to sync',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncInvoiceDto)
  invoices: SyncInvoiceDto[];
}

export class SyncResultDto {
  @ApiProperty({
    example: 'local-uuid-123',
    description: 'Local invoice ID',
  })
  localId: string;

  @ApiPropertyOptional({
    example: 'server-uuid-456',
    description: 'Server invoice ID (after sync)',
  })
  serverId?: string;

  @ApiProperty({
    example: 'SYNCED',
    description: 'Sync status: SYNCED or SYNC_FAILED',
    enum: ['SYNCED', 'SYNC_FAILED'],
  })
  status: 'SYNCED' | 'SYNC_FAILED';

  @ApiPropertyOptional({
    example: 'Insufficient stock for product',
    description: 'Error message (if sync failed)',
  })
  error?: string;
}

export class SyncResponseDto {
  @ApiProperty({
    type: [SyncResultDto],
    description: 'Successfully synced invoices',
  })
  synced: SyncResultDto[];

  @ApiProperty({
    type: [SyncResultDto],
    description: 'Failed to sync invoices',
  })
  failed: SyncResultDto[];
}

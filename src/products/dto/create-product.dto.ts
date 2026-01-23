import { IsString, IsNumber, IsOptional, IsUUID, Min, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitSizeUnit } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({
    example: 'NEW-PRODUCT-001',
    description: 'Product SKU (barcode/QR code value) - must be unique',
  })
  @IsString()
  @MinLength(1)
  sku: string;

  @ApiProperty({
    example: 'New Product Name',
    description: 'Product name',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Category ID (UUID) - Get from GET /admin/filters or GET /categories. Required - must exist in database.',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Brand ID (UUID) - Get from GET /admin/filters or GET /brands. Required - must exist in database.',
  })
  @IsUUID()
  brandId: string;

  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Manufacturer ID (UUID) - Get from GET /admin/filters or GET /manufacturers. Required - must exist in database.',
  })
  @IsUUID()
  manufacturerId: string;

  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Store ID (UUID) - Product belongs to this store. Get from GET /stores. Required - must exist in database.',
  })
  @IsUUID()
  storeId: string;

  @ApiProperty({
    example: 50.0,
    description: 'Unit price',
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'DEPRECATED: Unit size in milliliters (optional). Use unitSizeValue + unitSizeUnit instead.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitSizeMl?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Unit size value (e.g. 500)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitSizeValue?: number;

  @ApiPropertyOptional({
    example: 'ML',
    description: 'Unit size unit (ML, L, G, KG, PCS)',
    enum: UnitSizeUnit,
  })
  @IsOptional()
  @IsEnum(UnitSizeUnit)
  unitSizeUnit?: UnitSizeUnit;
}

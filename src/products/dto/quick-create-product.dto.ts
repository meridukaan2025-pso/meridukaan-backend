import { IsString, IsNumber, IsOptional, IsInt, Min, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitSizeUnit } from '@prisma/client';

export class QuickCreateProductDto {
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
    example: 'Soft Drinks',
    description: 'Category name (will create if doesn\'t exist)',
  })
  @IsString()
  @MinLength(1)
  categoryName: string;

  @ApiProperty({
    example: 'New Brand',
    description: 'Brand name (will create if doesn\'t exist)',
  })
  @IsString()
  @MinLength(1)
  brandName: string;

  @ApiProperty({
    example: 'New Manufacturer',
    description: 'Manufacturer name (will create if doesn\'t exist)',
  })
  @IsString()
  @MinLength(1)
  manufacturerName: string;

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

  @ApiPropertyOptional({ example: 500, description: 'Unit size value (e.g. 500)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitSizeValue?: number;

  @ApiPropertyOptional({ example: 'ML', description: 'Unit size unit (ML, L, G, KG, PCS)', enum: UnitSizeUnit })
  @IsOptional()
  @IsEnum(UnitSizeUnit)
  unitSizeUnit?: UnitSizeUnit;

  @ApiProperty({
    example: 10,
    description: 'Initial stock quantity for the current store. Required.',
  })
  @IsInt()
  @Min(0)
  stockQuantity: number;
}

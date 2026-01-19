import { IsString, IsNumber, IsOptional, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Unit size in milliliters (optional)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitSizeMl?: number;
}

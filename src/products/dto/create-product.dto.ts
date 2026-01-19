import { IsString, IsNumber, IsOptional, IsUUID, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Category ID',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Brand ID',
  })
  @IsUUID()
  brandId: string;

  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Manufacturer ID',
  })
  @IsUUID()
  manufacturerId: string;

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

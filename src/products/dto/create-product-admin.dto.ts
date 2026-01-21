import { IsString, IsNumber, IsOptional, IsUUID, IsInt, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductAdminDto {
  @ApiProperty({ example: 'NEW-SKU-001', description: 'Product SKU (barcode) - must be unique' })
  @IsString()
  @MinLength(1)
  sku: string;

  @ApiProperty({ example: 'Product Name' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ description: 'Use existing category by ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Beverages', description: 'Create or use existing category by name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryName?: string;

  @ApiPropertyOptional({ description: 'Use existing brand by ID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: 'New Brand', description: 'Create or use existing brand by name (requires manufacturer)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  brandName?: string;

  @ApiPropertyOptional({ description: 'Use existing manufacturer by ID (required when brandName is used)' })
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional({ example: 'New Manufacturer', description: 'Create or use existing manufacturer by name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  manufacturerName?: string;

  @ApiProperty({ example: 50.0, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitSizeMl?: number;

  @ApiPropertyOptional({ example: 10, description: 'Initial stock; requires storeId if > 0' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ description: 'Store to add initial stock to; required when stockQuantity > 0' })
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

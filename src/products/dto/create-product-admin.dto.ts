import { IsString, IsNumber, IsOptional, IsUUID, IsInt, Min, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitSizeUnit } from '@prisma/client';

export class CreateProductAdminDto {
  @ApiProperty({ example: 'NEW-SKU-001', description: 'Product SKU (barcode) - must be unique' })
  @IsString()
  @MinLength(1)
  sku: string;

  @ApiProperty({ example: 'Product Name' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ 
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Use existing category by ID (UUID). Either categoryId OR categoryName is required.' 
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ 
    example: 'Beverages', 
    description: 'Create or use existing category by name. Either categoryId OR categoryName is required. Recommended: Use name instead of ID.' 
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryName?: string;

  @ApiPropertyOptional({ 
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Use existing brand by ID (UUID). Either brandId OR brandName is required.' 
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ 
    example: 'Coca-Cola', 
    description: 'Create or use existing brand by name. Either brandId OR brandName is required. If using brandName, you must also provide manufacturerId or manufacturerName. Recommended: Use name instead of ID.' 
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  brandName?: string;

  @ApiPropertyOptional({ 
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Use existing manufacturer by ID (UUID). Required when brandName is used. Either manufacturerId OR manufacturerName.' 
  })
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional({ 
    example: 'The Coca-Cola Company', 
    description: 'Create or use existing manufacturer by name. Required when brandName is used. Either manufacturerId OR manufacturerName. Recommended: Use name instead of ID.' 
  })
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
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Store ID (UUID) - Product belongs to this store. Required. Get store IDs from GET /stores endpoint.',
  })
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({ example: 10, description: 'Initial stock; optional' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;
}

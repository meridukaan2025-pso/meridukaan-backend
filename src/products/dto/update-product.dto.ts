import { IsString, IsNumber, IsOptional, IsUUID, Min, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'UPDATED-SKU-001', description: 'Product SKU (must stay unique)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @ApiPropertyOptional({ example: 'Updated Product Name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: '4158f662-9e15-42ef-9c4e-345b9465693c' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: '4158f662-9e15-42ef-9c4e-345b9465693c' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: '4158f662-9e15-42ef-9c4e-345b9465693c' })
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional({ example: 55.0, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitSizeMl?: number;
}

import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class InvoiceItemDto {
  @ApiProperty({
    example: 'abc-123-def-456-ghi',
    description: 'Product UUID',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    example: 5,
    description: 'Quantity to purchase',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({
    description: 'Store UUID (optional). Automatically set for SALES users.',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiProperty({
    type: [InvoiceItemDto],
    example: [
      {
        productId: 'abc-123-def-456-ghi',
        qty: 5,
      },
    ],
    description: 'Array of invoice items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({
    example: 'INV-2026-001',
    description: 'Optional client invoice reference',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientInvoiceRef?: string;
}


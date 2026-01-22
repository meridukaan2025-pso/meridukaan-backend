import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanDto {
  @ApiProperty({
    example: 'COKE-330ML',
    description: 'QR code value (Product SKU). Store ID is automatically taken from your assigned store.',
  })
  @IsString()
  qrValue: string;

  // Commented out - Admin POS testing support
  // @ApiPropertyOptional({
  //   description: 'Store UUID (optional). Required for ADMIN users if not assigned to a store.',
  //   required: false,
  // })
  // @IsOptional()
  // @IsUUID()
  // storeId?: string;
}


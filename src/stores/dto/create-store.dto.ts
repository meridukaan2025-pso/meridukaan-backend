import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({
    example: 'My Store Name',
    description: 'Store name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Punjab',
    description: 'Store region (optional, defaults to empty string)',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    example: 'Lahore',
    description: 'Store city (optional, defaults to empty string)',
  })
  @IsOptional()
  @IsString()
  city?: string;
}

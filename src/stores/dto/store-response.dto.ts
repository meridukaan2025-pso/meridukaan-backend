import { ApiProperty } from '@nestjs/swagger';

export class StoreResponseDto {
  @ApiProperty({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Store UUID',
  })
  id: string;

  @ApiProperty({
    example: 'Store Karachi Central',
    description: 'Store name',
  })
  name: string;

  @ApiProperty({
    example: 'Sindh',
    description: 'Store region',
  })
  region: string;

  @ApiProperty({
    example: 'Karachi',
    description: 'Store city',
  })
  city: string;

  @ApiProperty({
    example: '2026-01-15T10:00:00.000Z',
    description: 'Store creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-01-15T10:00:00.000Z',
    description: 'Store last update timestamp',
  })
  updatedAt: Date;
}

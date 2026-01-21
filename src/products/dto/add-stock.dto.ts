import { IsUUID, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddStockDto {
  @ApiProperty({ description: 'Store to add or reduce stock in' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 10, description: 'Quantity to add (positive) or reduce (negative)' })
  @IsInt()
  quantity: number;
}

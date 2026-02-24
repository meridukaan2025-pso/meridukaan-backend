import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordByPhoneDto {
  @ApiProperty({ example: '+923001234567', description: 'Phone number in E.164 format (e.g. +923001234567)' })
  @IsString()
  @MinLength(10, { message: 'Phone number must be in E.164 format (e.g. +923001234567)' })
  phoneNumber: string;

  @ApiProperty({ example: '7f7a9f...reset-token...' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewStrongPassword123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

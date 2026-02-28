import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginByPhoneDto {
  @ApiProperty({
    example: '+923001234567',
    description: 'Phone number in E.164 format (e.g. +923001234567)',
  })
  @IsString()
  @MinLength(10, { message: 'Phone number must be in E.164 format (e.g. +923001234567)' })
  phoneNumber: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}

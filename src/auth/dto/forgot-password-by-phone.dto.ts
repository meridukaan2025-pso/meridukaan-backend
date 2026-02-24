import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsUrl } from 'class-validator';

export class ForgotPasswordByPhoneDto {
  @ApiProperty({ example: '+923001234567', description: 'Phone number in E.164 format (e.g. +923001234567)' })
  @IsString()
  @MinLength(10, { message: 'Phone number must be in E.164 format (e.g. +923001234567)' })
  phoneNumber: string;

  @ApiProperty({
    example: 'https://app.meridukaan.com/sales/reset-password',
    description: 'Frontend URL where the user will reset their password (optional)',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUrl?: string;
}

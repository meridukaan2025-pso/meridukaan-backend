import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Sales login: either Firebase idToken (after OTP) OR phoneNumber + password.
 * Phone number is primary; use idToken when coming from Firebase OTP flow.
 * Accepts "phone" or "phoneNumber" (phone is aliased to phoneNumber).
 */
export class SalesLoginDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description: 'Firebase ID token (after phone OTP). Use this OR phoneNumber+password.',
  })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({
    example: '+923001234567',
    description: 'Phone number in E.164 format. Use with password for direct login (no Firebase).',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Phone number must be in E.164 format (e.g. +923001234567)' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: '+923001234567',
    description: 'Alias for phoneNumber (same as phoneNumber).',
  })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Phone must be in E.164 format (e.g. +923001234567)' })
  phone?: string;

  @ApiPropertyOptional({
    example: 'password123',
    description: 'Password (use with phoneNumber for direct login).',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

import { IsEmail, IsString, MinLength, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class SignupDto {
  @ApiPropertyOptional({
    example: '+923001234567',
    description: 'Phone number in E.164 format (required for SALES role)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phoneNumber must be in E.164 format (e.g. +923001234567)',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'newuser@meridukaan.com',
    description: 'User email address (optional, must be unique if provided)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'User password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'SALES',
    description: 'User role',
    enum: UserRole,
    enumName: 'UserRole',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    example: '4158f662-9e15-42ef-9c4e-345b9465693c',
    description: 'Store ID (optional - use storeName instead to create new store during signup)',
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({
    example: 'My Store Name',
    description: 'Store name (optional - if provided, store will be created and storeId will be assigned automatically)',
  })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional({
    example: 'Punjab',
    description: 'Store region (optional - required if storeName is provided)',
  })
  @IsOptional()
  @IsString()
  storeRegion?: string;

  @ApiPropertyOptional({
    example: 'Lahore',
    description: 'Store city (optional - required if storeName is provided)',
  })
  @IsOptional()
  @IsString()
  storeCity?: string;

  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;
}

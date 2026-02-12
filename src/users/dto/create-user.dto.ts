import { IsEmail, IsString, MinLength, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiPropertyOptional({
    example: 'newuser@meridukaan.com',
    description: 'User email address (optional, must be unique if provided)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

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
    description: 'Store ID (required for SALES role)',
  })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;
}

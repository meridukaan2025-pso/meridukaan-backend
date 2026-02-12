import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    example: 'updated@meridukaan.com',
    description: 'User email address (must be unique)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+923001234567',
    description: 'Phone number in E.164 format (must be unique)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phoneNumber must be in E.164 format (e.g. +923001234567)',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'newPassword123',
    description: 'User password (minimum 6 characters)',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

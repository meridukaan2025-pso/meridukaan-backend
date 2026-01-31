import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '7f7a9f...reset-token...' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewStrongPassword123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

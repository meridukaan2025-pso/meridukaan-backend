import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUrl } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'https://app.meridukaan.com/reset-password',
    description: 'Frontend URL where the user will reset their password',
  })
  @IsUrl({ require_tld: false })
  redirectUrl: string;
}

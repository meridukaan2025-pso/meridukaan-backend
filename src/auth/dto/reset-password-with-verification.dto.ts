import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordWithVerificationDto {
  @ApiProperty({
    description: 'Firebase ID token after phone OTP verification',
  })
  @IsString()
  idToken: string;

  @ApiProperty({ example: 'NewStrongPassword123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

import { Controller, Get, Post, Put, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
@ApiBearerAuth('JWT-auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user', description: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @Put('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update own profile', 
    description: 'Update your own profile information (firstName, lastName, email, phoneNumber, password). Role and storeId cannot be changed through this endpoint.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        email: { type: 'string', example: 'updated@meridukaan.com' },
        phoneNumber: { type: 'string', nullable: true, example: '+923001234567' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        role: { type: 'string', enum: ['ADMIN', 'SALES', 'INVENTORY', 'PURCHASE'], example: 'SALES' },
        storeId: { type: 'string', nullable: true, example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        store: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            city: { type: 'string' },
            region: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 409, description: 'Conflict - User with this email already exists' })
  async updateProfile(@CurrentUser() user: { id: string }, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, updateProfileDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'User login', description: 'Authenticate user and receive JWT token' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'User signup', 
    description: 'Create a new user account and receive JWT token. Store ID and phone number are required for SALES role. Email is optional.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
            email: { type: 'string', nullable: true, example: 'newuser@meridukaan.com' },
            phoneNumber: { type: 'string', nullable: true, example: '+923001234567' },
            role: { type: 'string', enum: ['ADMIN', 'SALES', 'INVENTORY', 'PURCHASE'], example: 'SALES' },
            storeId: { type: 'string', nullable: true, example: '4158f662-9e15-42ef-9c4e-345b9465693c' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input, missing store ID, or missing phone number for SALES role' })
  @ApiResponse({ status: 409, description: 'Conflict - User with this email already exists' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Send password reset link to email if user exists',
  })
  @ApiResponse({ status: 200, description: 'Reset link sent if user exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('admin/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset (admin)',
    description: 'Send password reset link for admin users only',
  })
  @ApiResponse({ status: 200, description: 'Reset link sent if admin exists' })
  async adminForgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto, UserRole.ADMIN);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using token sent to email',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with Firebase ID token',
    description: 'Verify Firebase ID token and issue JWT',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.authService.loginWithFirebase(dto);
  }

  @Public()
  @Post('firebase/sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with Firebase ID token (sales)',
    description: 'Verify Firebase ID token for sales users using phone number and issue JWT',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async firebaseSalesLogin(@Body() dto: FirebaseLoginDto) {
    return this.authService.loginWithFirebase(dto, UserRole.SALES, { requirePhoneNumber: true });
  }

  @Public()
  @Post('firebase/admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with Firebase ID token (admin)',
    description: 'Verify Firebase ID token for admin users and issue JWT',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async firebaseAdminLogin(@Body() dto: FirebaseLoginDto) {
    return this.authService.loginWithFirebase(dto, UserRole.ADMIN);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'User logout', 
    description: 'Logout user. This endpoint is provided for consistency, but JWT tokens are stateless and cannot be invalidated server-side. Client should remove the token from storage.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  async logout() {
    return { message: 'Logged out successfully' };
  }
}

import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { UserRole } from '@prisma/client';
import { StoresService } from '../stores/stores.service';
import { EmailService } from '../email/email.service';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private storesService: StoresService,
    private configService: ConfigService,
    private emailService: EmailService,
    private firebaseService: FirebaseService,
  ) {}

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase();
  }

  private normalizePhoneNumber(phoneNumber?: string) {
    if (!phoneNumber) return undefined;

    const normalized = phoneNumber.trim().replace(/[()\-\s]/g, '');
    const isE164 = /^\+[1-9]\d{7,14}$/.test(normalized);

    if (!isE164) {
      throw new BadRequestException('Phone number must be in E.164 format (e.g. +923001234567)');
    }

    return normalized;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { store: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const payload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      storeId: user.storeId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: { id: true, name: true, city: true, region: true },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new UnauthorizedException('User not found');
    }

    const normalizedEmail = this.normalizeEmail(updateProfileDto.email);
    const normalizedPhoneNumber = this.normalizePhoneNumber(updateProfileDto.phoneNumber);

    // Check email uniqueness if email is being updated
    if (normalizedEmail && normalizedEmail !== existingUser.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      });

      if (emailExists) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Check phone number uniqueness if phone is being updated
    if (normalizedPhoneNumber && normalizedPhoneNumber !== existingUser.phoneNumber) {
      const phoneExists = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          phoneNumber: normalizedPhoneNumber,
        },
      });

      if (phoneExists) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    // Prepare update data (only firstName, lastName, email, password allowed)
    const updateData: any = {};

    if (updateProfileDto.firstName !== undefined) {
      updateData.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName !== undefined) {
      updateData.lastName = updateProfileDto.lastName;
    }
    if (normalizedEmail) {
      updateData.email = normalizedEmail;
    }
    if (normalizedPhoneNumber) {
      updateData.phoneNumber = normalizedPhoneNumber;
    }

    // Hash password if provided
    if (updateProfileDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateProfileDto.password, 10);
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    });

    return updatedUser;
  }

  async signup(signupDto: SignupDto) {
    const normalizedEmail = this.normalizeEmail(signupDto.email);
    const normalizedPhoneNumber = this.normalizePhoneNumber(signupDto.phoneNumber);

    // Check if phone number is already in use
    if (normalizedPhoneNumber) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: normalizedPhoneNumber },
      });

      if (existingPhone) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    // Check if email is already in use (if provided)
    if (normalizedEmail) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });

      if (existingEmail) {
        throw new ConflictException('User with this email already exists');
      }
    }

    let finalStoreId: string | null = null;

    // Flow: If storeName is provided, create store first and get storeId
    if (signupDto.storeName) {
      // Create store with provided name
      const newStore = await this.storesService.create({
        name: signupDto.storeName,
        region: signupDto.storeRegion || '',
        city: signupDto.storeCity || '',
      });
      finalStoreId = newStore.id;
    } else if (signupDto.storeId) {
      // If storeId is provided, validate it exists
      const store = await this.prisma.store.findUnique({
        where: { id: signupDto.storeId },
      });

      if (!store) {
        // Provide helpful error message with available stores info
        const allStores = await this.prisma.store.findMany({
          select: { id: true, name: true },
        });
        const storeList = allStores.map(s => `${s.name} (${s.id})`).join(', ');
        throw new BadRequestException(
          `Store not found with ID: ${signupDto.storeId}. ${allStores.length > 0 ? `Available stores: ${storeList}` : 'No stores available in the system.'}`
        );
      }
      finalStoreId = signupDto.storeId;
    }

    // Validate storeId if role is SALES
    if (signupDto.role === UserRole.SALES && !finalStoreId) {
      throw new BadRequestException('Store ID or Store Name is required for SALES role. Provide either storeId (existing store) or storeName (to create new store).');
    }
    if (signupDto.role === UserRole.SALES && !normalizedPhoneNumber) {
      throw new BadRequestException('Phone number is required for SALES role');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    // Create user with the final storeId (either from created store or provided storeId)
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhoneNumber,
        passwordHash,
        role: signupDto.role,
        storeId: finalStoreId,
        firstName: signupDto.firstName,
        lastName: signupDto.lastName,
      },
      include: { store: true },
    });

    // Generate JWT token (same as login)
    const payload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      storeId: user.storeId,
    };

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userWithoutPassword.id,
        email: userWithoutPassword.email,
        phoneNumber: userWithoutPassword.phoneNumber ?? null,
        firstName: userWithoutPassword.firstName ?? null,
        lastName: userWithoutPassword.lastName ?? null,
        role: userWithoutPassword.role,
        storeId: userWithoutPassword.storeId,
      },
    };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildResetUrl(redirectUrl: string, token: string, email: string) {
    const url = new URL(redirectUrl);
    url.searchParams.set('token', token);
    url.searchParams.set('email', email);
    return url.toString();
  }

  async requestPasswordReset(dto: ForgotPasswordDto, requiredRole?: UserRole) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!user || (requiredRole && user.role !== requiredRole)) {
      return { message: 'If the account exists, a reset link will be sent.' };
    }

    const ttlMinutes = Number(this.configService.get<string>('PASSWORD_RESET_TTL_MINUTES') || 60);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    if (!user.email) {
      return { message: 'If the account exists, a reset link will be sent.' };
    }

    const resetUrl = this.buildResetUrl(dto.redirectUrl, token, user.email);
    await this.emailService.sendPasswordResetEmail(user.email, resetUrl);

    return { message: 'If the account exists, a reset link will be sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const tokenHash = this.hashResetToken(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        user: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }

  async loginWithFirebase(
    dto: FirebaseLoginDto,
    requiredRole?: UserRole,
    options?: { requirePhoneNumber?: boolean },
  ) {
    const decoded = await this.firebaseService.verifyIdToken(dto.idToken);
    const email = this.normalizeEmail(decoded.email);
    const phoneNumber = this.normalizePhoneNumber(decoded.phone_number);
    const requirePhoneNumber = options?.requirePhoneNumber || requiredRole === UserRole.SALES;

    if (requirePhoneNumber && !phoneNumber) {
      throw new BadRequestException('Firebase token missing phone number');
    }

    if (!email && !phoneNumber) {
      throw new BadRequestException('Firebase token missing email and phone number');
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(phoneNumber ? [{ phoneNumber }] : []),
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
        ],
      },
      include: { store: true },
    });

    // Fallback for legacy/stale data where phone numbers were stored with spaces/hyphens.
    if (!user && phoneNumber) {
      const candidates = await this.prisma.user.findMany({
        where: {
          phoneNumber: { not: null },
          ...(requiredRole ? { role: requiredRole } : {}),
        },
        include: { store: true },
      });

      user = candidates.find((candidate) => {
        try {
          const normalizedCandidatePhone = this.normalizePhoneNumber(candidate.phoneNumber || undefined);
          return normalizedCandidatePhone === phoneNumber;
        } catch {
          return false;
        }
      });
    }

    if (!user) {
      if (requirePhoneNumber && phoneNumber) {
        throw new UnauthorizedException(
          `No backend ${requiredRole || 'user'} account linked to phone number ${phoneNumber}`,
        );
      }
      throw new UnauthorizedException('User not found');
    }

    if (requiredRole && user.role !== requiredRole) {
      throw new UnauthorizedException('Access denied for this role');
    }

    const normalizedUserPhone = this.normalizePhoneNumber(user.phoneNumber || undefined);
    if (requirePhoneNumber && normalizedUserPhone !== phoneNumber) {
      throw new UnauthorizedException('Phone number not linked to this account');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      storeId: user.storeId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        role: user.role,
        storeId: user.storeId,
      },
    };
  }
}

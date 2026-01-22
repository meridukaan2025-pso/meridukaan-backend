import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from '@prisma/client';
import { StoresService } from '../stores/stores.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private storesService: StoresService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
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
      role: user.role,
      storeId: user.storeId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
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

    // Check email uniqueness if email is being updated
    if (updateProfileDto.email && updateProfileDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateProfileDto.email },
      });

      if (emailExists) {
        throw new ConflictException('User with this email already exists');
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
    if (updateProfileDto.email) {
      updateData.email = updateProfileDto.email;
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
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
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

    // Hash password
    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    // Create user with the final storeId (either from created store or provided storeId)
    const user = await this.prisma.user.create({
      data: {
        email: signupDto.email,
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
      role: user.role,
      storeId: user.storeId,
    };

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userWithoutPassword.id,
        email: userWithoutPassword.email,
        firstName: userWithoutPassword.firstName ?? null,
        lastName: userWithoutPassword.lastName ?? null,
        role: userWithoutPassword.role,
        storeId: userWithoutPassword.storeId,
      },
    };
  }
}


import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  async create(createUserDto: CreateUserDto) {
    const normalizedEmail = this.normalizeEmail(createUserDto.email);
    const normalizedPhoneNumber = this.normalizePhoneNumber(createUserDto.phoneNumber);

    // Check email uniqueness if provided
    if (normalizedEmail) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });

      if (existingEmail) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Check phone number uniqueness if provided
    if (normalizedPhoneNumber) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: normalizedPhoneNumber },
      });

      if (existingPhone) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    // Validate required fields for SALES role
    if (createUserDto.role === UserRole.SALES && !createUserDto.storeId) {
      throw new BadRequestException('Store ID is required for SALES role');
    }
    if (createUserDto.role === UserRole.SALES && !normalizedPhoneNumber) {
      throw new BadRequestException('Phone number is required for SALES role');
    }

    // Validate store exists if storeId is provided
    if (createUserDto.storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: createUserDto.storeId },
      });

      if (!store) {
        throw new BadRequestException('Store not found');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhoneNumber,
        passwordHash,
        role: createUserDto.role,
        storeId: createUserDto.storeId,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      },
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

    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const normalizedEmail = this.normalizeEmail(updateUserDto.email);
    const normalizedPhoneNumber = this.normalizePhoneNumber(updateUserDto.phoneNumber);

    // Check email uniqueness if email is being updated
    if (normalizedEmail && normalizedEmail !== existingUser.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
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
          id: { not: id },
          phoneNumber: normalizedPhoneNumber,
        },
      });

      if (phoneExists) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    // Validate storeId if role is SALES
    const roleToCheck = updateUserDto.role || existingUser.role;
    const storeIdToCheck = updateUserDto.storeId !== undefined ? updateUserDto.storeId : existingUser.storeId;
    const phoneToCheck = normalizedPhoneNumber ?? existingUser.phoneNumber;

    if (roleToCheck === UserRole.SALES && !storeIdToCheck) {
      throw new BadRequestException('Store ID is required for SALES role');
    }
    if (roleToCheck === UserRole.SALES && !phoneToCheck) {
      throw new BadRequestException('Phone number is required for SALES role');
    }

    // Validate store exists if storeId is provided
    if (storeIdToCheck) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeIdToCheck },
      });

      if (!store) {
        throw new BadRequestException('Store not found');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateUserDto.firstName !== undefined) {
      updateData.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      updateData.lastName = updateUserDto.lastName;
    }
    if (normalizedEmail) {
      updateData.email = normalizedEmail;
    }

    if (normalizedPhoneNumber) {
      updateData.phoneNumber = normalizedPhoneNumber;
    }

    if (updateUserDto.role) {
      updateData.role = updateUserDto.role;
    }

    if (updateUserDto.storeId !== undefined) {
      updateData.storeId = updateUserDto.storeId;
    }

    // Hash password if provided
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
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

  async remove(id: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Delete user
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: `User with ID ${id} has been deleted successfully`,
      deletedUser: {
        id: user.id,
        email: user.email,
      },
    };
  }
}

import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new user', 
    description: 'Create a new user account. Requires ADMIN role. Store ID is required for SALES role.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        email: { type: 'string', example: 'newuser@meridukaan.com' },
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
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input or store ID required for SALES role' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 409, description: 'Conflict - User with this email already exists' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all users', 
    description: 'Retrieve a list of all users. Requires ADMIN role.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of users retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
          email: { type: 'string', example: 'user@meridukaan.com' },
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
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get user by ID', 
    description: 'Retrieve a specific user by their ID. Requires ADMIN role.' 
  })
  @ApiParam({ name: 'id', description: 'User UUID', example: '4158f662-9e15-42ef-9c4e-345b9465693c' })
  @ApiResponse({ 
    status: 200, 
    description: 'User retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        email: { type: 'string', example: 'user@meridukaan.com' },
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
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update user', 
    description: 'Update user information. All fields are optional. Requires ADMIN role.' 
  })
  @ApiParam({ name: 'id', description: 'User UUID', example: '4158f662-9e15-42ef-9c4e-345b9465693c' })
  @ApiResponse({ 
    status: 200, 
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '4158f662-9e15-42ef-9c4e-345b9465693c' },
        email: { type: 'string', example: 'updated@meridukaan.com' },
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
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input or store ID required for SALES role' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Conflict - User with this email already exists' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete user', 
    description: 'Delete a user by ID. Requires ADMIN role.' 
  })
  @ApiParam({ name: 'id', description: 'User UUID', example: '4158f662-9e15-42ef-9c4e-345b9465693c' })
  @ApiResponse({ 
    status: 200, 
    description: 'User deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User with ID xxx has been deleted successfully' },
        deletedUser: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

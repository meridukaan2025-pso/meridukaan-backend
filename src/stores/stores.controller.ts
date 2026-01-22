import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { Public } from '../common/decorators/public.decorator';
import { StoreResponseDto } from './dto/store-response.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Public()
  @Get()
  @ApiOperation({ 
    summary: 'Get all stores', 
    description: 'Retrieve a list of all stores. Public endpoint - no authentication required.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of stores retrieved successfully',
    type: [StoreResponseDto],
  })
  async findAll(): Promise<StoreResponseDto[]> {
    return this.storesService.findAll();
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new store', 
    description: 'Create a new store and get store ID. Public endpoint - used during user signup. Pass store name in body, API will assign a store ID.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Store created successfully',
    type: StoreResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input' })
  async create(@Body() createStoreDto: CreateStoreDto): Promise<StoreResponseDto> {
    return this.storesService.create(createStoreDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete store', description: 'Delete a store by ID. ADMIN only. Fails if store has users, inventory, or invoices.' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, description: 'Store deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete: store has users, inventory, or invoices' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  async remove(@Param('id') id: string) {
    return this.storesService.remove(id);
  }
}

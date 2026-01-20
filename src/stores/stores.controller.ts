import { Controller, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { Public } from '../common/decorators/public.decorator';
import { StoreResponseDto } from './dto/store-response.dto';
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
    description: 'Retrieve a list of all stores. Public endpoint - no authentication required. Use this to get store IDs for user signup.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of stores retrieved successfully',
    type: [StoreResponseDto],
  })
  async findAll(): Promise<StoreResponseDto[]> {
    return this.storesService.findAll();
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

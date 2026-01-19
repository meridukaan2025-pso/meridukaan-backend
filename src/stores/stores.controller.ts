import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { Public } from '../common/decorators/public.decorator';
import { StoreResponseDto } from './dto/store-response.dto';

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
}

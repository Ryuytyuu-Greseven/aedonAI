import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/user.interface';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SalesPropertiesService } from './sales-properties.service';

@UseGuards(JwtAuthGuard)
@Controller('sales/properties')
export class SalesPropertiesController {
  constructor(
    private readonly salesPropertiesService: SalesPropertiesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesPropertiesService.create(dto, user.companyId);
  }

  @Get()
  findAll(
    @Query() query: ListPropertiesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesPropertiesService.findAllByAgent(
      query.agentId,
      user.companyId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesPropertiesService.findById(id, user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesPropertiesService.update(id, dto, user.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesPropertiesService.delete(id, user.companyId);
  }
}

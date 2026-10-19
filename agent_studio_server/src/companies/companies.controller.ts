import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandControlAuthGuard } from '../command-control/guards/command-control-auth.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

// Company management is a command-control (internal portal) concern, not a
// per-company admin one, so it's gated by the command-control login instead
// of the regular JwtAuthGuard/RolesGuard used elsewhere.
@UseGuards(CommandControlAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.companiesService.disable(id);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string) {
    return this.companiesService.enable(id);
  }
}

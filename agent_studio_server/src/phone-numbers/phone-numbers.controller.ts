import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { AssignAgentDto } from './dto/assign-agent.dto';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';
import { ListPhoneNumbersDto } from './dto/list-phone-numbers.dto';
import { PhoneNumbersService } from './phone-numbers.service';

@UseGuards(JwtAuthGuard)
@Controller('phone-numbers')
export class PhoneNumbersController {
  constructor(private readonly phoneNumbersService: PhoneNumbersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreatePhoneNumberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phoneNumbersService.create(dto, user.companyId);
  }

  @Get()
  findAll(
    @Query() query: ListPhoneNumbersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phoneNumbersService.findAll(user.companyId, query.envType);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.phoneNumbersService.findById(id, user.companyId);
  }

  @Patch(':id/assign-agent')
  assignAgent(
    @Param('id') id: string,
    @Body() dto: AssignAgentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phoneNumbersService.assignAgent(
      id,
      dto.assigned_agent,
      user.companyId,
    );
  }

  @Post(':id/disable')
  disable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.phoneNumbersService.disable(id, user.companyId);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.phoneNumbersService.enable(id, user.companyId);
  }
}

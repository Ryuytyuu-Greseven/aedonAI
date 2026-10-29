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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { AssignAgentDto } from './dto/assign-agent.dto';
import { ListPhoneNumbersDto } from './dto/list-phone-numbers.dto';
import { PurchasePhoneNumberDto } from './dto/purchase-phone-number.dto';
import { SearchAvailableNumbersDto } from './dto/search-available-numbers.dto';
import { PhoneNumbersService } from './phone-numbers.service';

// RolesGuard only enforces routes that carry @Roles; the rest stay open to
// any authenticated user of the company.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('phone-numbers')
export class PhoneNumbersController {
  constructor(private readonly phoneNumbersService: PhoneNumbersService) {}

  /** Live Twilio (US) / Exotel (IN) inventory search. Declared before `:id`. */
  @Get('available')
  @Roles('admin')
  searchAvailable(@Query() query: SearchAvailableNumbersDto) {
    return this.phoneNumbersService.searchAvailable(query);
  }

  /** Buys a number from the provider — billed to the platform account. */
  @Post('purchase')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  purchase(
    @Body() dto: PurchasePhoneNumberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phoneNumbersService.purchase(dto, user);
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

  /** Releases the number back to the provider (stops billing). */
  @Delete(':id')
  @Roles('admin')
  release(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.phoneNumbersService.release(id, user.companyId);
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

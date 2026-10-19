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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { CreateFrontlineAgentDto } from './dto/create-frontline-agent.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateFrontlineAgentNameDto } from './dto/update-frontline-agent-name.dto';
import { FrontlineAgentsService } from './frontline-agents.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('frontline-agents')
export class FrontlineAgentsController {
  constructor(
    private readonly frontlineAgentsService: FrontlineAgentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateFrontlineAgentDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.frontlineAgentsService.create(dto, admin.companyId);
  }

  @Get()
  findAll(@CurrentUser() admin: AuthenticatedUser) {
    return this.frontlineAgentsService.findAll(admin.companyId);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.frontlineAgentsService.disable(id, admin.companyId);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.frontlineAgentsService.enable(id, admin.companyId);
  }

  @Patch(':id/name')
  updateName(
    @Param('id') id: string,
    @Body() dto: UpdateFrontlineAgentNameDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.frontlineAgentsService.updateName(
      id,
      dto.name,
      admin.companyId,
    );
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.frontlineAgentsService.resetPassword(
      id,
      dto.newPassword,
      admin.companyId,
    );
  }
}

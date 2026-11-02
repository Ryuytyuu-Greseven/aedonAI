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
import { UpdateCallSettingsDto } from './dto/call-settings.dto';
import { ListLeadsQueryDto } from '../common/dto/list-leads-query.dto';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { GoLiveDto } from './dto/go-live.dto';
import { ListProductStatsQueryDto } from './dto/list-product-stats-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.findAll(user.companyId);
  }

  @Get('live')
  findAllLive(@CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.findAllLive(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.findById(id, user.companyId);
  }

  @Post()
  create(@Body() dto: CreateAgentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.create(dto, user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentsService.update(id, dto, user.companyId);
  }

  /** Dialing rules only — never moves the agent back to draft. */
  @Patch(':id/call-settings')
  updateCallSettings(
    @Param('id') id: string,
    @Body() dto: UpdateCallSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentsService.updateCallSettings(id, dto, user.companyId);
  }

  @Post(':id/stage')
  stage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.moveToStage(id, user.companyId);
  }

  @Post(':id/live')
  live(
    @Param('id') id: string,
    @Body() dto: GoLiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentsService.moveToLive(id, dto, user.companyId);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.disable(id, user.companyId);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.enable(id, user.companyId);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.listHistory(id, user.companyId);
  }

  @Get('by-agent-id/:agentId/history')
  historyByAgentId(
    @Param('agentId') agentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentsService.listHistoryByAgentId(agentId, user.companyId);
  }

  @Get(':id/leads')
  leads(
    @Param('id') id: string,
    @Query() query: ListLeadsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentsService.listLeads(id, user.companyId, query);
  }

  @Get(':id/product-stats')
  productStats(
    @Param('id') id: string,
    @Query() query: ListProductStatsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentsService.productStats(id, user.companyId, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.delete(id, user.companyId);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.clone(id, user.companyId);
  }

  @Post(':id/preview')
  preview(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.preview(id, user.companyId);
  }
}

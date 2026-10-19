import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/user.interface';
import { AssignAgentToPageDto } from './dto/assign-agent-to-page.dto';
import { ConnectMetaDto } from './dto/connect-meta.dto';
import { ListMetaLeadsQueryDto } from './dto/list-meta-leads-query.dto';
import { MetaIntegrationsService } from './meta-integrations.service';

@UseGuards(JwtAuthGuard)
@Controller('integrations/meta')
export class MetaIntegrationsController {
  constructor(
    private readonly metaIntegrationsService: MetaIntegrationsService,
  ) {}

  @Post('connect')
  connect(@Body() dto: ConnectMetaDto, @Req() req: Request) {
    // JwtAuthGuard already validated this; meta-adapter re-validates it
    // itself against the shared users/revoked_tokens collections.
    const authorizationHeader = req.headers.authorization ?? '';
    return this.metaIntegrationsService.connect(dto, authorizationHeader);
  }

  @Get('pages')
  listPages(@CurrentUser() user: AuthenticatedUser) {
    return this.metaIntegrationsService.listPages(user.companyId);
  }

  @Get('leads')
  listLeads(
    @Query() query: ListMetaLeadsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metaIntegrationsService.listLeads(user.companyId, query);
  }

  @Post('pages/:pageId/disable')
  disablePage(
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metaIntegrationsService.disablePage(user.companyId, pageId);
  }

  @Post('pages/:pageId/enable')
  enablePage(
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metaIntegrationsService.enablePage(user.companyId, pageId);
  }

  @Post('pages/disable-all')
  disconnectAllPages(@CurrentUser() user: AuthenticatedUser) {
    return this.metaIntegrationsService.disconnectAllPages(user.companyId);
  }

  @Post('pages/enable-all')
  enableAllPages(@CurrentUser() user: AuthenticatedUser) {
    return this.metaIntegrationsService.enableAllPages(user.companyId);
  }

  @Patch('pages/:pageId/assign-agent')
  assignAgent(
    @Param('pageId') pageId: string,
    @Body() dto: AssignAgentToPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metaIntegrationsService.assignAgentToPage(
      user.companyId,
      pageId,
      dto,
    );
  }

  @Post('pages/:pageId/unassign-agent')
  unassignAgent(
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metaIntegrationsService.unassignAgentFromPage(
      user.companyId,
      pageId,
    );
  }
}

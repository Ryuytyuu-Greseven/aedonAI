import { BadRequestException, Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/user.interface';
import { DialManualLeadDto } from './dto/dial-manual-lead.dto';
import { ManualLeadCallService } from './manual-lead-call.service';

/** Calls for manual leads, forwarded by agent_studio_server with the user's JWT. */
@Controller('leads/manual')
@UseGuards(JwtAuthGuard)
export class ManualLeadsController {
  constructor(private readonly manualLeadCallService: ManualLeadCallService) { }

  @Post('dial')
  async dial(@Body() dto: DialManualLeadDto, @CurrentUser() user: AuthenticatedUser) {
    return await this.manualLeadCallService.dialNumber(dto, this.requireCompanyId(user));
  }

  @Post(':leadId/call')
  async call(@Param('leadId') leadId: string, @CurrentUser() user: AuthenticatedUser) {
    return await this.manualLeadCallService.callLeadManually(leadId, this.requireCompanyId(user));
  }

  private requireCompanyId(user: AuthenticatedUser): string {
    if (!user.companyId) throw new BadRequestException('User is not associated with a company');
    return user.companyId;
  }
}

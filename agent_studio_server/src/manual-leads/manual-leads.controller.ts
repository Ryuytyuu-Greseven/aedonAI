import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { DialManualLeadDto } from './dto/dial-manual-lead.dto';
import { UploadManualLeadsDto } from './dto/upload-manual-leads.dto';
import { ManualLeadsService } from './manual-leads.service';

/** Listing stays on `GET /agents/:id/leads?source=manual`. */
@UseGuards(JwtAuthGuard)
@Controller('agents/:id/leads/manual')
export class ManualLeadsController {
  constructor(private readonly manualLeadsService: ManualLeadsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  upload(
    @Param('id') id: string,
    @Body() dto: UploadManualLeadsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.manualLeadsService.upload(id, user.companyId, dto.leads);
  }

  /** Forwarded with the caller's JWT, like Meta lead calls. */
  @Post('dial')
  dial(
    @Param('id') id: string,
    @Body() dto: DialManualLeadDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.manualLeadsService.dial(
      id,
      user.companyId,
      dto,
      req.headers.authorization ?? '',
    );
  }

  @Post(':leadId/call')
  call(
    @Param('id') id: string,
    @Param('leadId') leadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.manualLeadsService.callLead(
      id,
      leadId,
      user.companyId,
      req.headers.authorization ?? '',
    );
  }
}

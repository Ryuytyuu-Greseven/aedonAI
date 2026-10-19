import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateReportDto } from './dto/generate-report.dto';
import { SetFrequencyDto } from './dto/set-frequency.dto';
import {
  SendReportEmailDto,
  SendReportWhatsAppDto,
} from './dto/send-report.dto';
import { ReportingService } from './reporting.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportingController {
  private readonly logger = new Logger(ReportingController.name);

  constructor(private readonly reportingService: ReportingService) {}

  @Post('agents/:id/reports/generate')
  generate(@Param('id') id: string, @Body() dto: GenerateReportDto) {
    return this.reportingService.generateReport(id, dto);
  }

  @Get('agents/:id/reports/:reportId/download')
  async download(@Param('reportId') reportId: string, @Res() res: Response) {
    const { filename, buffer } =
      await this.reportingService.downloadReport(reportId);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('agents/:id/report-frequency')
  async getFrequency(@Param('id') id: string) {
    const frequency = await this.reportingService.getFrequencyPreference(id);
    return { frequency };
  }

  @Put('agents/:id/report-frequency')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setFrequency(@Param('id') id: string, @Body() dto: SetFrequencyDto) {
    await this.reportingService.setFrequencyPreference(id, dto.frequency);
  }

  // Provider undecided (backend-openspec/specs/reporting/spec.md open decision).
  // Accepted and logged so the frontend integration path is real end-to-end;
  // wire to SendGrid/SES/Postmark/etc. once a provider is chosen.
  @Post('reports/send-email')
  @HttpCode(HttpStatus.ACCEPTED)
  sendEmail(@Body() dto: SendReportEmailDto) {
    this.logger.log(
      `Report email delivery requested for ${dto.recipient} (${dto.filename ?? 'unnamed report'}) — no provider configured yet`,
    );
  }

  @Post('reports/send-whatsapp')
  @HttpCode(HttpStatus.ACCEPTED)
  sendWhatsApp(@Body() dto: SendReportWhatsAppDto) {
    this.logger.log(
      `Report WhatsApp delivery requested for ${dto.recipient} (${dto.filename ?? 'unnamed report'}) — no provider configured yet`,
    );
  }
}

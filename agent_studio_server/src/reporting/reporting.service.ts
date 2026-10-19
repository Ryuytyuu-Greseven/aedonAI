import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AgentsService } from '../agents/agents.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { ReportFrequencyRepository } from '../repos/report-frequency.repository';
import { CallLog } from '../schemas/call-logs.schema';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportFrequency } from '../schemas/report-frequency.schema';

export interface GeneratedReport {
  reportId: string;
  filename: string;
  rows: CallLog[];
}

function computeDateRange(dto: GenerateReportDto): { start: Date; end: Date } {
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  switch (dto.period) {
    case 'daily':
      return { start: todayMidnight, end: now };
    case 'weekly': {
      const start = new Date(todayMidnight);
      start.setDate(start.getDate() - 6);
      return { start, end: now };
    }
    case 'monthly': {
      const start = new Date(todayMidnight);
      start.setDate(start.getDate() - 29);
      return { start, end: now };
    }
    case 'custom': {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException(
          'startDate and endDate are required when period is "custom"',
        );
      }
      const start = new Date(`${dto.startDate}T00:00:00.000`);
      const end = new Date(`${dto.endDate}T23:59:59.999`);
      return { start, end };
    }
  }
}

function encodeReportId(agentId: string, dto: GenerateReportDto): string {
  const payload = JSON.stringify({ agentId, ...dto });
  return Buffer.from(payload).toString('base64url');
}

function decodeReportId(
  reportId: string,
): { agentId: string } & GenerateReportDto {
  try {
    return JSON.parse(Buffer.from(reportId, 'base64url').toString('utf8')) as {
      agentId: string;
    } & GenerateReportDto;
  } catch {
    throw new BadRequestException('Invalid reportId');
  }
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly reportFrequencyRepository: ReportFrequencyRepository,
    private readonly monitoringService: MonitoringService,
    private readonly agentsService: AgentsService,
  ) {}

  async generateReport(
    agentId: string,
    dto: GenerateReportDto,
  ): Promise<GeneratedReport> {
    const { rows } = await this.computeReportRows(agentId, dto);
    return {
      reportId: encodeReportId(agentId, dto),
      filename: `report-${agentId}-${dto.period}.xlsx`,
      rows,
    };
  }

  async downloadReport(
    reportId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const decoded = decodeReportId(reportId);
    const { rows, filename } = await this.computeReportRows(
      decoded.agentId,
      decoded,
    );
    const buffer = await this.buildXlsx(rows);
    return { filename, buffer };
  }

  async getFrequencyPreference(
    agentId: string,
  ): Promise<ReportFrequency | null> {
    const pref =
      await this.reportFrequencyRepository.filterByAgentId(agentId);
    return pref?.frequency ?? null;
  }

  async setFrequencyPreference(
    agentId: string,
    frequency: ReportFrequency,
  ): Promise<void> {
    await this.agentsService.findById(agentId);
    await this.reportFrequencyRepository.upsertByAgentId(agentId, frequency);
  }

  private async computeReportRows(
    agentId: string,
    dto: GenerateReportDto,
  ): Promise<{ rows: CallLog[]; filename: string }> {
    const { start, end } = computeDateRange(dto);
    const allRecords = await this.monitoringService.getRecordsForAgent(agentId);
    const rows = allRecords.filter(
      (record) =>
        record.starting_time >= start && record.starting_time <= end,
    );
    return { rows, filename: `report-${agentId}-${dto.period}.xlsx` };
  }

  private async buildXlsx(rows: CallLog[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    sheet.columns = [
      { header: 'Call ID', key: 'id', width: 28 },
      { header: 'Agent ID', key: 'agent_id', width: 28 },
      { header: 'Direction', key: 'direction', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Occurred At', key: 'occurred_at', width: 24 },
    ];
    for (const row of rows) {
      sheet.addRow({
        id: String(row._id),
        agent_id: row.agent_id,
        direction: row.direction,
        status: row.status,
        occurred_at: row.starting_time,
      });
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}

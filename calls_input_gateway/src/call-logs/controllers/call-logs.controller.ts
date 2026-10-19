import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CallLogService } from '../services/call-log.service';
import { CallLog } from '../interfaces/call-log.interface';

@Controller('call-logs')
export class CallLogsController {
  constructor(private readonly callLogService: CallLogService) {}

  @Get(':callId')
  async getCallLog(@Param('callId') callId: string): Promise<CallLog> {
    const log = await this.callLogService.getCallLog(callId);
    if (!log) throw new NotFoundException(`Call log ${callId} not found`);
    return log;
  }

  @Patch(':callId/summary')
  async updateSummary(
    @Param('callId') callId: string,
    @Body() body: { summary: string },
  ): Promise<{ success: boolean }> {
    await this.callLogService.updateCallSummary(callId, body.summary);
    return { success: true };
  }

  @Patch(':callId/customer-details')
  async updateCustomerDetails(
    @Param('callId') callId: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ success: boolean }> {
    await this.callLogService.updateCustomerDetails(callId, body);
    return { success: true };
  }

  @Post(':callId/human-agents')
  async connectHumanAgent(
    @Param('callId') callId: string,
    @Body() body: { agent_id: string },
  ): Promise<{ success: boolean }> {
    await this.callLogService.connectHumanAgent(callId, {
      agentId: body.agent_id,
    });
    return { success: true };
  }
}

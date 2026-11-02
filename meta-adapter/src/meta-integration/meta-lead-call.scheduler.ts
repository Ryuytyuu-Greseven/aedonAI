import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { MetaLeadCallService } from './meta-lead-call.service';
import { ManualLeadCallService } from './manual-lead-call.service';
import { MissedCallRetryService } from './missed-call-retry.service';

const JOB_NAME = 'meta-lead-call';

/**
 * Periodically dials via calls_input_gateway: new Meta leads, then new
 * manual leads (uploaded on the leads page), then due missed-call retries.
 * Each agent's calls only start inside its calling hours. Separate
 * from the sync cron so storing leads and calling them can be switched on
 * independently — and off by default, since enabling it places real calls.
 */
@Injectable()
export class MetaLeadCallScheduler implements OnModuleInit {
  private readonly logger = new Logger(MetaLeadCallScheduler.name);
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly metaLeadCallService: MetaLeadCallService,
    private readonly manualLeadCallService: ManualLeadCallService,
    private readonly missedCallRetryService: MissedCallRetryService,
  ) { }

  onModuleInit() {
    if (this.configService.get<string>('META_LEAD_CALL_ENABLED', 'false') !== 'true') {
      this.logger.log('Lead call cron disabled (set META_LEAD_CALL_ENABLED=true to enable)');
      return;
    }

    const schedule = this.configService.get<string>('META_LEAD_CALL_CRON', '* * * * *');
    const job = new CronJob(schedule, () => this.run());
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Lead call cron scheduled: "${schedule}"`);
  }

  private async run() {
    // Skip a tick if the previous run is still placing calls
    if (this.running) {
      this.logger.warn('Previous lead call run still in progress, skipping this tick');
      return;
    }

    this.running = true;
    try {
      await this.metaLeadCallService.dispatchPendingCalls();
    } catch (error) {
      this.logger.error(`Scheduled lead call run failed: ${error.message}`);
    }
    try {
      await this.manualLeadCallService.dispatchPendingCalls();
    } catch (error) {
      this.logger.error(`Scheduled manual lead call run failed: ${error.message}`);
    }
    try {
      await this.missedCallRetryService.dispatchDue();
    } catch (error) {
      this.logger.error(`Scheduled missed-call retry run failed: ${error.message}`);
    } finally {
      this.running = false;
    }
  }
}

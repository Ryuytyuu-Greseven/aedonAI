import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { MetaLeadSyncService } from './meta-lead-sync.service';

const JOB_NAME = 'meta-lead-sync';

/**
 * Runs the lead polling sync on a schedule inside meta-adapter. It only
 * stores missed leads in meta_leads — dialing them is the calling service's
 * job (leads with empty callAttempts). Registered at startup rather than via
 * @Cron so the schedule can come from .env.
 */
@Injectable()
export class MetaLeadSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(MetaLeadSyncScheduler.name);
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly metaLeadSyncService: MetaLeadSyncService,
  ) { }

  onModuleInit() {
    if (this.configService.get<string>('META_LEAD_SYNC_ENABLED', 'true') === 'false') {
      this.logger.log('Lead sync cron disabled (META_LEAD_SYNC_ENABLED=false)');
      return;
    }

    const schedule = this.configService.get<string>('META_LEAD_SYNC_CRON', '*/5 * * * *');
    const job = new CronJob(schedule, () => this.run());
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Lead sync cron scheduled: "${schedule}"`);
  }

  private async run() {
    // Skip a tick if the previous sync is still going (many pages / slow Graph API)
    if (this.running) {
      this.logger.warn('Previous lead sync still running, skipping this tick');
      return;
    }

    this.running = true;
    try {
      await this.metaLeadSyncService.syncLeads();
    } catch (error) {
      this.logger.error(`Scheduled lead sync failed: ${error.message}`);
    } finally {
      this.running = false;
    }
  }
}

import * as QueueRepo from '../repository/analysis-queue.repository.js';
import * as SummaryRepo from '../repository/conversation-summary.repository.js';
import { analyzeConversation } from '../service/conversation-analyzer.service.js';
import * as CatalogueRepo from '../repository/product-catalogue.repository.js';
import { AnalysisQueueItem } from '../schema/analysis-queue-item.schema.js';

const IDLE_POLL_INTERVAL_MS = 15_000;

/**
 * Drains the analysis queue one job at a time. When the queue is empty it
 * backs off to a fixed interval and polls again — the "cron" behavior — so
 * a newly enqueued conversation is always picked up within
 * IDLE_POLL_INTERVAL_MS even without any push/event mechanism. Processing
 * stays strictly sequential (await one job fully before claiming the next),
 * so at most one ended call is ever being analyzed at a time.
 */
export class AnalysisWorker {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleTick(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleTick(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.inFlight = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    let job: AnalysisQueueItem | null = null;
    try {
      job = await QueueRepo.claimNext();
    } catch (error) {
      console.error('[ConversationAnalysis] Failed to claim next job:', error);
    }

    if (!job) {
      this.scheduleTick(IDLE_POLL_INTERVAL_MS);
      return;
    }

    await this.processOne(job);
    // Work was found — check again immediately rather than waiting out the
    // idle interval, so a backlog drains as fast as the LLM allows.
    this.scheduleTick(0);
  }

  private async processOne(job: AnalysisQueueItem): Promise<void> {
    try {
      const catalogue = job.agentId
        ? await CatalogueRepo.findProductsForAgent(job.agentId, job.companyId)
        : [];
      const analysis = await analyzeConversation(job.transcript, catalogue);
      await SummaryRepo.saveSummary({
        conversationId: job.conversationId,
        agentId: job.agentId,
        companyId: job.companyId,
        customerId: job.customerId,
        customerPhone: job.customerPhone,
        ...analysis,
      });
      if (job.agentId) {
        const discussedIds = new Set(analysis.propertiesDiscussedIds);
        await CatalogueRepo.recordDiscussedProducts(
          {
            conversationId: job.conversationId,
            agentId: job.agentId,
            companyId: job.companyId,
            callId: job.callId,
            customerPhone: job.customerPhone || null,
            channel: job.channel === 'preview' ? 'preview' : 'live',
            // When the call happened, not when the queue got to it.
            at: job.transcript.at(-1)?.timestamp ?? job.enqueuedAt,
          },
          catalogue.filter((p) => discussedIds.has(p.id)),
        );
      }
      await QueueRepo.markDone(String(job._id));
    } catch (error: any) {
      console.error(`[ConversationAnalysis] Failed to analyze conversation ${job.conversationId}:`, error);
      await QueueRepo.markFailed(String(job._id), error?.message ?? String(error));
    }
  }

  /** Test/shutdown helper — resolves once any job currently being processed finishes. */
  async waitForCurrentJob(): Promise<void> {
    await this.inFlight;
  }
}

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ActiveSession } from '../../../core/models/active-session.model';
import { Agent } from '../../../core/models/agent.model';
import { AgentCallStats, CallRecord, DayCallStats } from '../../../core/models/call-record.model';
import { AgentService } from '../../../core/services/agent.service';
import { CallRecordService } from '../../../core/services/call-record.service';
import { ActiveSessionService } from '../../../core/services/active-session.service';
import { ToastService } from '../../../core/services/toast.service';
import { ActiveSessionsComponent } from '../active-sessions/active-sessions.component';
import { AgentReportsComponent } from '../agent-reports/agent-reports.component';
import { CallLogComponent } from '../call-log/call-log.component';
import { CallDetailModalComponent } from '../call-detail-modal/call-detail-modal.component';
import { ActionItemsComponent } from '../action-items/action-items.component';
import { LeadsComponent } from '../leads/leads.component';
import { ProductStatsComponent } from '../product-stats/product-stats.component';
import { isSalesTemplate } from '../../../shared/constants/agent-templates.constant';

// 'active-sessions' and 'actions' tabs are hidden for now (screens not ready / no
// requirement yet) — kept in the union and their template branches left intact so
// re-enabling later is just adding the tab buttons back. See monitor-detail.component.html.
type MonitorTab = 'overview' | 'product-stats' | 'reports' | 'call-log' | 'active-sessions' | 'actions' | 'leads';

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const CHART_WINDOW_SIZE = 10;

@Component({
  selector: 'app-monitor-detail',
  standalone: true,
  imports: [RouterLink, AgentReportsComponent, CallLogComponent, CallDetailModalComponent, ActionItemsComponent, ActiveSessionsComponent, LeadsComponent, ProductStatsComponent],
  templateUrl: './monitor-detail.component.html',
  styleUrl: './monitor-detail.component.css',
})
export class MonitorDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agentService = inject(AgentService);
  private readonly callRecordService = inject(CallRecordService);
  private readonly activeSessionService = inject(ActiveSessionService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly agent = signal<Agent | null>(null);
  readonly stats = signal<AgentCallStats | null>(null);
  readonly activeTab = signal<MonitorTab>('overview');
  readonly selectedCall = signal<CallRecord | null>(null);
  readonly chartWindowOffset = signal(0);
  /** Shown in Overview while the Active Sessions tab is hidden — see the `MonitorTab` note above. */
  readonly activeSessionsCount = signal(0);
  /** Only sales agents have products (`sales_properties`), so only they get the Product Stats tab. */
  readonly isSalesAgent = computed(() => isSalesTemplate(this.agent()?.base_template_id));

  private windowBounds(offset: number): { start: number; end: number } {
    const total = this.stats()?.byDay.length ?? 0;
    const end = Math.max(0, total - offset * CHART_WINDOW_SIZE);
    const start = Math.max(0, end - CHART_WINDOW_SIZE);
    return { start, end };
  }

  readonly visibleDays = computed<DayCallStats[]>(() => {
    const byDay = this.stats()?.byDay ?? [];
    const { start, end } = this.windowBounds(this.chartWindowOffset());
    return byDay.slice(start, end);
  });

  readonly canGoBack = computed(() => this.windowBounds(this.chartWindowOffset()).start > 0);
  readonly canGoForward = computed(() => this.chartWindowOffset() > 0);

  readonly chartWindowLabel = computed(() => {
    const days = this.visibleDays();
    if (days.length === 0) return '';
    return `${this.formatDay(days[0].date)} – ${this.formatDay(days[days.length - 1].date)}`;
  });

  readonly maxDailyTotal = computed(() => {
    return Math.max(1, ...this.visibleDays().map((d) => d.inbound + d.outbound));
  });

  readonly ringRadius = RING_RADIUS;

  readonly todayStats = computed<DayCallStats | null>(() => this.stats()?.byDay.at(-1) ?? null);

  readonly todayTotal = computed(() => {
    const day = this.todayStats();
    return day ? day.inbound + day.outbound : 0;
  });

  private readonly inboundShare = computed(() => {
    const day = this.todayStats();
    const total = this.todayTotal();
    if (!day || total === 0) return 0;
    return day.inbound / total;
  });

  readonly inboundSharePct = computed(() => Math.round(this.inboundShare() * 100));
  readonly outboundSharePct = computed(() => 100 - this.inboundSharePct());

  readonly inboundArc = computed(() => {
    const len = RING_CIRCUMFERENCE * this.inboundShare();
    return { dasharray: `${len} ${RING_CIRCUMFERENCE}`, dashoffset: 0 };
  });

  readonly outboundArc = computed(() => {
    const inboundLen = RING_CIRCUMFERENCE * this.inboundShare();
    const outboundLen = RING_CIRCUMFERENCE - inboundLen;
    return { dasharray: `${outboundLen} ${RING_CIRCUMFERENCE}`, dashoffset: -inboundLen };
  });

  readonly inboundLabelPos = computed(() => this.labelPosition(this.inboundShare() / 2));
  readonly outboundLabelPos = computed(() => this.labelPosition((1 + this.inboundShare()) / 2));

  private labelPosition(fraction: number): { left: number; top: number } {
    const angle = fraction * 2 * Math.PI - Math.PI / 2;
    const radiusPct = 46;
    return {
      left: 50 + radiusPct * Math.cos(angle),
      top: 50 + radiusPct * Math.sin(angle),
    };
  }

  readonly gridlineSteps = computed(() => {
    const step = this.niceStep(this.maxDailyTotal() / 4);
    return [step, step * 2, step * 3, step * 4];
  });

  ngOnInit(): void {
    const agentId = this.route.snapshot.paramMap.get('agentId');
    if (!agentId) {
      this.router.navigateByUrl('/monitor');
      return;
    }

    this.agentService.getAgent(agentId).subscribe({
      next: (agent) => {
        this.agent.set(agent);
        this.callRecordService.getStatsForAgent(agentId).subscribe((stats) => {
          this.stats.set(stats);
          this.loading.set(false);
        });
        this.activeSessionService.getActiveSessions(agentId).subscribe((sessions) => {
          this.activeSessionsCount.set(sessions.length);
        });
      },
      error: () => this.router.navigateByUrl('/monitor'),
    });
  }

  setTab(tab: MonitorTab): void {
    this.activeTab.set(tab);
  }

  goBack(): void {
    if (this.canGoBack()) this.chartWindowOffset.update((o) => o + 1);
  }

  goForward(): void {
    if (this.canGoForward()) this.chartWindowOffset.update((o) => Math.max(0, o - 1));
  }

  openCall(record: CallRecord): void {
    this.selectedCall.set(record);
  }

  closeCallDetail(): void {
    this.selectedCall.set(null);
  }

  onJoinSession(session: ActiveSession): void {
    this.toastService.info(`Joining ${session.customerName}'s call is coming soon.`);
  }

  segmentHeight(count: number): number {
    return (count / this.maxDailyTotal()) * 100;
  }

  gridlineOffset(value: number): number {
    return Math.min(100, (value / this.maxDailyTotal()) * 100);
  }

  private niceStep(roughStep: number): number {
    if (roughStep <= 5) return 5;
    if (roughStep <= 10) return 10;
    if (roughStep <= 20) return 20;
    if (roughStep <= 25) return 25;
    if (roughStep <= 50) return 50;
    return Math.ceil(roughStep / 50) * 50;
  }

  formatDay(dateOnly: string): string {
    // Parse as noon to avoid UTC-midnight rolling back a day in timezones west of UTC.
    return new Date(`${dateOnly}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  formatDayShort(dateOnly: string): string {
    return new Date(`${dateOnly}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric' });
  }
}

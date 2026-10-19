import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeneratedReport, ReportFrequency, ReportPeriod } from '../../../core/models/report.model';
import { ReportService } from '../../../core/services/report.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-agent-reports',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './agent-reports.component.html',
  styleUrl: './agent-reports.component.css',
})
export class AgentReportsComponent implements OnInit {
  @Input({ required: true }) agentId!: string;
  @Input({ required: true }) agentName!: string;

  private readonly reportService = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly period = signal<ReportPeriod>('weekly');
  readonly customStart = signal('');
  readonly customEnd = signal('');

  readonly generating = signal(false);
  readonly report = signal<GeneratedReport | null>(null);
  readonly sendingEmail = signal(false);
  readonly sendingWhatsApp = signal(false);

  readonly frequency = signal<ReportFrequency | null>(null);
  readonly savingFrequency = signal(false);

  ngOnInit(): void {
    this.reportService.getFrequencyPreference(this.agentId).subscribe((freq) => this.frequency.set(freq));
  }

  setPeriod(period: ReportPeriod): void {
    this.period.set(period);
    this.report.set(null);
  }

  generate(): void {
    this.generating.set(true);
    this.report.set(null);
    this.reportService
      .generateReport({
        agentId: this.agentId,
        period: this.period(),
        startDate: this.period() === 'custom' ? this.customStart() : undefined,
        endDate: this.period() === 'custom' ? this.customEnd() : undefined,
      })
      .subscribe((report) => {
        this.generating.set(false);
        this.report.set(report);
      });
  }

  download(): void {
    const report = this.report();
    if (!report?.reportId) return;

    this.reportService.downloadReport(this.agentId, report.reportId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = report.filename || `${this.agentName}-${this.period()}-report.xlsx`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Failed to download report'),
    });
  }

  sendEmail(): void {
    const report = this.report();
    if (!report) return;

    this.sendingEmail.set(true);
    this.reportService.sendReportEmail(report).subscribe(() => {
      this.sendingEmail.set(false);
      this.toast.success('Report sent via email');
    });
  }

  sendWhatsApp(): void {
    const report = this.report();
    if (!report) return;

    this.sendingWhatsApp.set(true);
    this.reportService.sendReportWhatsApp(report).subscribe(() => {
      this.sendingWhatsApp.set(false);
      this.toast.success('Report sent via WhatsApp');
    });
  }

  saveFrequency(): void {
    const freq = this.frequency();
    if (!freq) return;

    this.savingFrequency.set(true);
    this.reportService.setFrequencyPreference(this.agentId, freq).subscribe(() => {
      this.savingFrequency.set(false);
      this.toast.success('Report frequency preference saved');
    });
  }
}

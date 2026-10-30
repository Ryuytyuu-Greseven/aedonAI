import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManualLead, ManualLeadInput } from '../../../core/models/lead.model';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { LeadService } from '../../../core/services/lead.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import {
  LEAD_SHEET_TEMPLATE_CSV,
  LeadSheetRow,
  leadRowErrors,
  parseLeadSheet,
  resolveLeadPhone,
} from '../../../core/utils/manual-lead.util';
import { COUNTRY_CODES } from '../../../shared/constants/countries.constant';
import { ModalComponent } from '../../../shared/modal/modal.component';

const MANUAL_LEADS_LIMIT = 20;
const INDIA_DIAL_CODE = '+91';

/** One editable row in the upload review table. */
interface DraftRow extends LeadSheetRow {
  key: number;
  /** '' = Auto: `+…` as typed, bare 10 digits → +91. */
  dialCode: string;
  /** Why the server rejected the row on the last submit; cleared once it's edited. */
  serverErrors: string[];
}

/**
 * Manual leads for one agent: upload a sheet (reviewed and fixed in a table before it's sent),
 * call a typed-in number, and call stored leads. Calls go through meta-adapter, whose cron also
 * dials new manual leads once within a week, like Page leads.
 */
@Component({
  selector: 'app-manual-leads',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './manual-leads.component.html',
  styleUrls: ['../leads/leads.component.css', './manual-leads.component.css'],
})
export class ManualLeadsComponent implements OnChanges {
  private readonly leadService = inject(LeadService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) agentId!: string;

  readonly countries = COUNTRY_CODES;

  // List
  readonly loading = signal(true);
  readonly leads = signal<ManualLead[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / MANUAL_LEADS_LIMIT)));
  readonly callingLeadIds = signal<ReadonlySet<string>>(new Set());

  // Upload review
  readonly parsing = signal(false);
  readonly drafts = signal<DraftRow[]>([]);
  readonly showReview = signal(false);
  readonly submitting = signal(false);
  /** Outcome of the last submit, shown above the rows that still need fixing. */
  readonly lastUpload = signal<{ inserted: number; duplicates: number } | null>(null);
  readonly invalidCount = computed(() => this.drafts().filter((row) => this.rowErrors(row).length > 0).length);
  private nextKey = 0;

  // Call a number
  readonly showDial = signal(false);
  readonly dialing = signal(false);
  dialCode = INDIA_DIAL_CODE;
  dialNumber = '';
  dialName = '';
  dialError = '';

  ngOnChanges(): void {
    if (!this.agentId) return;
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.leadService.getManualLeads(this.agentId, { page: this.page(), limit: MANUAL_LEADS_LIMIT }).subscribe({
      next: (result) => {
        this.leads.set(result.leads);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load manual leads');
      },
    });
  }

  prevPage(): void {
    if (this.page() === 1) return;
    this.page.update((p) => p - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() === this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  // ── Upload ──────────────────────────────────────────────

  downloadTemplate(): void {
    const url = URL.createObjectURL(new Blob([LEAD_SHEET_TEMPLATE_CSV], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'manual-leads-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async onFileSelected(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = ''; // so picking the same file again still fires
    if (!file) return;

    this.parsing.set(true);
    try {
      const rows = await parseLeadSheet(file);
      if (rows.length === 0) {
        this.toast.error('The sheet has a header row but no leads');
        return;
      }
      this.drafts.set(rows.map((row) => ({ ...row, key: this.nextKey++, dialCode: '', serverErrors: [] })));
      this.lastUpload.set(null);
      this.showReview.set(true);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Could not read the file');
    } finally {
      this.parsing.set(false);
    }
  }

  rowErrors(row: DraftRow): string[] {
    return [...leadRowErrors(row, row.dialCode), ...row.serverErrors];
  }

  /** Any edit clears the server's verdict — the row is re-checked on the next submit. */
  updateRow(row: DraftRow, change: Partial<LeadSheetRow & { dialCode: string }>): void {
    this.drafts.update((rows) => rows.map((r) => (r.key === row.key ? { ...r, ...change, serverErrors: [] } : r)));
  }

  removeRow(row: DraftRow): void {
    this.drafts.update((rows) => rows.filter((r) => r.key !== row.key));
    if (this.drafts().length === 0) this.closeReview();
  }

  closeReview(): void {
    if (this.submitting()) return;
    this.showReview.set(false);
    this.drafts.set([]);
  }

  /**
   * Sends every row (all pass the local checks). Added and duplicate rows leave the table; rows the
   * server rejects stay with its reasons, so only those are fixed and sent again.
   */
  submitDrafts(): void {
    const rows = this.drafts();
    if (rows.length === 0 || this.invalidCount() > 0 || this.submitting()) return;

    const payload: ManualLeadInput[] = rows.map((row) => ({
      fullName: row.fullName.trim(),
      phoneNumber: resolveLeadPhone(row.phone, row.dialCode) ?? row.phone.trim(),
      email: row.email.trim(),
    }));

    this.submitting.set(true);
    this.leadService.uploadManualLeads(this.agentId, payload).subscribe({
      next: (result) => {
        this.submitting.set(false);
        const rejected = new Map(result.rejected.map((r) => [r.index, r.errors]));
        this.drafts.set(
          rows.flatMap((row, index) => {
            const errors = rejected.get(index);
            return errors ? [{ ...row, serverErrors: errors }] : [];
          }),
        );

        const summary = this.uploadSummary(result.inserted, result.duplicates.length);
        if (rejected.size === 0) {
          this.toast.success(summary);
          this.closeReview();
        } else {
          this.lastUpload.set({ inserted: result.inserted, duplicates: result.duplicates.length });
          this.toast.warning(`${summary}. Fix the ${rejected.size} row${rejected.size === 1 ? '' : 's'} left and submit again.`);
        }
        if (result.inserted > 0) {
          this.page.set(1);
          this.load();
        }
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.toast.error(extractErrorMessage(err, 'Could not add the leads'));
      },
    });
  }

  private uploadSummary(inserted: number, duplicates: number): string {
    const parts = [`Added ${inserted} lead${inserted === 1 ? '' : 's'}`];
    if (duplicates) parts.push(`${duplicates} already added today (skipped)`);
    return parts.join(' · ');
  }

  // ── Call a number ───────────────────────────────────────

  openDial(): void {
    this.dialCode = INDIA_DIAL_CODE;
    this.dialNumber = '';
    this.dialName = '';
    this.dialError = '';
    this.showDial.set(true);
  }

  closeDial(): void {
    if (this.dialing()) return;
    this.showDial.set(false);
  }

  dial(): void {
    if (this.dialing()) return;
    const phoneNumber = resolveLeadPhone(this.dialNumber, this.dialCode);
    if (!phoneNumber) {
      this.dialError = this.dialNumber.trim() ? 'Enter a valid number for the selected country' : 'Phone number is required';
      return;
    }
    this.dialError = '';
    this.dialing.set(true);
    this.leadService.dialManualLead(this.agentId, phoneNumber, this.dialName.trim() || undefined).subscribe({
      next: () => {
        this.dialing.set(false);
        this.showDial.set(false);
        this.toast.success(`Calling ${this.dialName.trim() || phoneNumber}…`);
        this.page.set(1);
        this.load();
      },
      error: (err: unknown) => {
        this.dialing.set(false);
        this.dialError = extractErrorMessage(err, 'The call could not be placed');
      },
    });
  }

  // ── Call a stored lead ──────────────────────────────────

  callAttemptsLabel(lead: ManualLead): string {
    if (lead.call_status === 'dialing') return 'Calling…';
    if (lead.call_status === 'failed') return 'Last call failed';
    const count = lead.call_attempts_count;
    if (count === 0) return 'Not called yet';
    return `Called ${count} time${count === 1 ? '' : 's'}`;
  }

  /** Mirrors the backend's rules: needs a phone number, not mid-call, not excluded from calling. */
  canCallLead(lead: ManualLead): boolean {
    return (
      !!lead.phone_number &&
      lead.call_status !== 'dialing' &&
      lead.call_status !== 'skipped' &&
      !this.callingLeadIds().has(lead.lead_id)
    );
  }

  callButtonTitle(lead: ManualLead): string {
    if (lead.call_status === 'skipped') return 'This lead is excluded from calling';
    if (lead.call_status === 'dialing') return 'A call to this lead is already in progress';
    return `Call ${lead.phone_number} with this agent`;
  }

  callLead(lead: ManualLead): void {
    if (!this.canCallLead(lead)) return;

    this.confirmDialog
      .confirm({
        title: lead.call_attempts_count > 0 ? 'Call this lead again?' : 'Call this lead?',
        message: `The agent will call ${lead.full_name || 'this lead'} on ${lead.phone_number} right away.`,
        confirmLabel: 'Call now',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        const leadId = lead.lead_id;
        this.setCalling(leadId, true);
        this.leadService.callManualLead(this.agentId, leadId).subscribe({
          next: () => {
            this.setCalling(leadId, false);
            this.updateLead(leadId, (l) => ({
              ...l,
              call_status: 'initiated',
              call_attempts_count: l.call_attempts_count + 1,
              last_call_error: null,
            }));
            this.toast.success(`Calling ${lead.full_name || lead.phone_number}…`);
          },
          error: (err) => {
            this.setCalling(leadId, false);
            // 502 = the gateway/telephony provider rejected it; the backend has marked the lead failed.
            if (err?.status === 502) this.updateLead(leadId, (l) => ({ ...l, call_status: 'failed' }));
            this.toast.error(extractErrorMessage(err, 'The call could not be placed'));
          },
        });
      });
  }

  private setCalling(leadId: string, calling: boolean): void {
    this.callingLeadIds.update((ids) => {
      const next = new Set(ids);
      if (calling) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }

  private updateLead(leadId: string, change: (lead: ManualLead) => ManualLead): void {
    this.leads.update((leads) => leads.map((l) => (l.lead_id === leadId ? change(l) : l)));
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SalesAgentAccount } from '../../../core/models/sales-agent-account.model';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/modal/modal.component';

export type StatusFilter = 'all' | 'active' | 'disabled';

export interface PasswordStrength {
  score: number; // 0–4, drives the meter segments
  label: string;
}

/** Unambiguous characters for generated passwords (no 0/O, 1/l/I). */
const PASSWORD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*-_';
const GENERATED_PASSWORD_LENGTH = 14;

@Component({
  selector: 'app-sales-agent-list',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './sales-agent-list.component.html',
  styleUrl: './sales-agent-list.component.css',
})
export class SalesAgentListComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly accounts = signal<SalesAgentAccount[]>([]);
  readonly statusUpdatingId = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  readonly stats = computed(() => {
    const list = this.accounts();
    const now = new Date();
    const active = list.filter((a) => a.enabled).length;
    const addedThisMonth = list.filter((a) => {
      const d = new Date(a.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return { total: list.length, active, disabled: list.length - active, addedThisMonth };
  });

  readonly filteredAccounts = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.accounts().filter((a) => {
      if (status === 'active' && !a.enabled) return false;
      if (status === 'disabled' && a.enabled) return false;
      return !term || a.name.toLowerCase().includes(term) || a.email.toLowerCase().includes(term);
    });
  });

  /** Shared by the create and reset-password dialogs (only one is open at a time). */
  showPassword = false;

  showCreateForm = false;
  createName = '';
  createEmail = '';
  createPassword = '';
  createError = '';
  creating = false;

  editNameTarget: SalesAgentAccount | null = null;
  editNameValue = '';
  editNameError = '';
  savingName = false;

  resetPasswordTarget: SalesAgentAccount | null = null;
  resetPasswordValue = '';
  resetPasswordConfirm = '';
  resetPasswordError = '';
  resettingPassword = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.adminService.listSalesAgents().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load sales agent accounts');
      },
    });
  }

  openCreateForm(): void {
    this.showCreateForm = true;
    this.createName = '';
    this.createEmail = '';
    this.createPassword = '';
    this.createError = '';
    this.showPassword = false;
  }

  cancelCreate(): void {
    this.showCreateForm = false;
    this.createError = '';
  }

  create(): void {
    const name = this.createName?.trim();
    const email = this.createEmail?.trim();
    const password = this.createPassword;
    if (!name) {
      this.createError = 'Enter a name';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.createError = 'Enter a valid email address';
      return;
    }
    if (password.length < 8) {
      this.createError = 'Password must be at least 8 characters';
      return;
    }
    this.createError = '';
    this.creating = true;
    this.adminService.createSalesAgent({ name, email, password }).subscribe({
      next: (created) => {
        this.creating = false;
        this.accounts.update((list) => [created, ...list]);
        this.toast.success(`Sales agent login created for ${created.name}`);
        this.showCreateForm = false;
      },
      error: (err: unknown) => {
        this.creating = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.createError = 'An account with this email already exists';
          return;
        }
        this.toast.error('Failed to create sales agent account');
      },
    });
  }

  toggleEnabled(account: SalesAgentAccount): void {
    if (this.statusUpdatingId()) return;
    this.statusUpdatingId.set(account.id);
    this.adminService.setSalesAgentEnabled(account.id, !account.enabled).subscribe({
      next: (updated) => {
        this.statusUpdatingId.set(null);
        this.accounts.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
        this.toast.success(updated.enabled ? 'Account enabled' : 'Account disabled');
      },
      error: () => {
        this.statusUpdatingId.set(null);
        this.toast.error('Failed to update account status');
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  initials(name: string): string {
    const parts = name?.trim().split(/\s+/).filter(Boolean);
    if (!parts || parts?.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  openEditName(account: SalesAgentAccount): void {
    this.editNameTarget = account;
    this.editNameValue = account.name;
    this.editNameError = '';
  }

  cancelEditName(): void {
    this.editNameTarget = null;
    this.editNameError = '';
  }

  submitEditName(): void {
    const target = this.editNameTarget;
    if (!target) return;
    const name = this.editNameValue?.trim();
    if (!name) {
      this.editNameError = 'Enter a name';
      return;
    }
    this.editNameError = '';
    this.savingName = true;
    this.adminService.updateSalesAgentName(target.id, name).subscribe({
      next: (updated) => {
        this.savingName = false;
        this.accounts.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
        this.toast.success(`Name updated for ${updated.email}`);
        this.editNameTarget = null;
      },
      error: () => {
        this.savingName = false;
        this.toast.error('Failed to update name');
      },
    });
  }

  openResetPassword(account: SalesAgentAccount): void {
    this.resetPasswordTarget = account;
    this.resetPasswordValue = '';
    this.resetPasswordConfirm = '';
    this.resetPasswordError = '';
    this.showPassword = false;
  }

  cancelResetPassword(): void {
    this.resetPasswordTarget = null;
    this.resetPasswordError = '';
  }

  submitResetPassword(): void {
    const target = this.resetPasswordTarget;
    if (!target) return;
    if (this.resetPasswordValue.length < 8) {
      this.resetPasswordError = 'Password must be at least 8 characters';
      return;
    }
    if (this.resetPasswordValue !== this.resetPasswordConfirm) {
      this.resetPasswordError = 'Passwords do not match';
      return;
    }
    this.resetPasswordError = '';
    this.resettingPassword = true;
    this.adminService.resetSalesAgentPassword(target.id, this.resetPasswordValue).subscribe({
      next: () => {
        this.resettingPassword = false;
        this.toast.success(`Password reset for ${target.email}`);
        this.resetPasswordTarget = null;
      },
      error: () => {
        this.resettingPassword = false;
        this.toast.error('Failed to reset password');
      },
    });
  }

  clearSearch(): void {
    this.search.set('');
  }

  /** Fills the create form's password field with a strong random password and reveals it. */
  generateCreatePassword(): void {
    this.createPassword = this.generatePassword();
    this.showPassword = true;
  }

  /** Fills both reset-password fields with the same strong random password and reveals it. */
  generateResetPassword(): void {
    this.resetPasswordValue = this.resetPasswordConfirm = this.generatePassword();
    this.showPassword = true;
  }

  passwordStrength(password: string): PasswordStrength {
    if (!password) return { score: 0, label: '' };
    if (password.length < 8) return { score: 1, label: 'Too short' };
    let score = 1;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
    return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
  }

  /** Stable per-person gradient so avatars are easy to tell apart. */
  avatarBackground(name: string): string {
    let hash = 0;
    for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 72% 62%), hsl(${(hue + 40) % 360} 70% 48%))`;
  }

  private generatePassword(): string {
    const bytes = crypto.getRandomValues(new Uint32Array(GENERATED_PASSWORD_LENGTH));
    return Array.from(bytes, (b) => PASSWORD_CHARSET[b % PASSWORD_CHARSET.length]).join('');
  }
}

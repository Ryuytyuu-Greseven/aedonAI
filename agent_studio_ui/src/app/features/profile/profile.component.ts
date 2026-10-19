import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserProfile } from '../../core/models/profile.model';
import { Company } from '../../core/models/company.model';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';

function emptyProfile(): UserProfile {
  return { name: '', email: '' };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editing = signal(false);
  readonly profile = signal<UserProfile>(emptyProfile());
  readonly company = signal<Company | null>(null);
  readonly isAdmin = computed(() => this.authService.role() === 'admin');
  readonly initial = computed(() => (this.profile().name || this.profile().email).charAt(0).toUpperCase() || '?');

  form: UserProfile = emptyProfile();
  errors: Record<string, string> = {};

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.profileService.getMyProfile().subscribe({
      next: ({ profile, company }) => {
        this.profile.set(profile);
        this.company.set(company);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load profile');
      },
    });
  }

  startEdit(): void {
    this.form = structuredClone(this.profile());
    this.errors = {};
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.errors = {};
  }

  save(): void {
    const errors: Record<string, string> = {};
    if (!this.form.name.trim()) {
      errors['name'] = 'Name is required';
    }
    this.errors = errors;
    if (Object.keys(errors).length > 0) {
      return;
    }

    this.saving.set(true);
    this.profileService.updateMyProfile(this.form.name.trim()).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.profile.update((current) => ({ ...current, ...updated }));
        this.editing.set(false);
        this.toast.success('Profile updated');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Failed to save profile — your changes were not lost, try again');
      },
    });
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MetaIntegrationService } from '../../../core/services/meta-integration.service';
import { MetaOAuthService } from '../../../core/services/meta-oauth.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

@Component({
  selector: 'app-meta-integration-callback',
  standalone: true,
  templateUrl: './meta-integration-callback.component.html',
  styleUrl: './meta-integration-callback.component.css',
})
export class MetaIntegrationCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly metaIntegration = inject(MetaIntegrationService);
  private readonly metaOAuth = inject(MetaOAuthService);
  private readonly toast = inject(ToastService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !this.metaOAuth.consumeState(state)) {
      this.toast.error('Meta connection could not be verified. Please try connecting again.');
      this.router.navigateByUrl('/admin-settings');
      return;
    }

    this.metaIntegration.connect(code).subscribe({
      next: () => {
        this.toast.success('Connected to Meta');
        this.router.navigateByUrl('/admin-settings');
      },
      error: (err: unknown) => {
        this.toast.error(extractErrorMessage(err, 'Failed to connect to Meta'));
        this.router.navigateByUrl('/admin-settings');
      },
    });
  }
}

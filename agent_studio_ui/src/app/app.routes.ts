import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    // Unguarded: the emailed link must work even if the browser still holds a session
    // (the component signs that session out).
    path: 'reset-password',
    loadComponent: () =>
      import('./features/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'monitor', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'playground',
        children: [
          { path: '', redirectTo: 'new', pathMatch: 'full' },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/playground/template-picker/template-picker.component').then(
                (m) => m.TemplatePickerComponent
              ),
          },
          {
            path: 'new/:templateId',
            loadComponent: () =>
              import('./features/playground/playground-editor/playground-editor.component').then(
                (m) => m.PlaygroundEditorComponent
              ),
          },
          {
            path: 'drafted',
            loadComponent: () =>
              import('./features/playground/drafted-list/drafted-list.component').then(
                (m) => m.DraftedListComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/playground/playground-editor/playground-editor.component').then(
                (m) => m.PlaygroundEditorComponent
              ),
          },
        ],
      },
      {
        path: 'monitor',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/monitor-agents/monitor-list/monitor-list.component').then(
                (m) => m.MonitorListComponent
              ),
          },
          {
            path: ':agentId',
            loadComponent: () =>
              import('./features/monitor-agents/monitor-detail/monitor-detail.component').then(
                (m) => m.MonitorDetailComponent
              ),
          },
        ],
      },
      {
        path: 'knowledge-base',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/knowledge-base/knowledge-base-list/knowledge-base-list.component').then(
                (m) => m.KnowledgeBaseListComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/knowledge-base/knowledge-base-detail/knowledge-base-detail.component').then(
                (m) => m.KnowledgeBaseDetailComponent
              ),
          },
        ],
      },
      {
        path: 'phone-numbers',
        loadComponent: () =>
          import('./features/phone-numbers/phone-number-list/phone-number-list.component').then(
            (m) => m.PhoneNumberListComponent
          ),
      },
      {
        path: 'agents/new',
        loadComponent: () =>
          import('./features/agent-builder/agent-builder.component').then((m) => m.AgentBuilderComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'agents/:id',
        loadComponent: () =>
          import('./features/agent-builder/agent-builder.component').then((m) => m.AgentBuilderComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin-panel/sales-agent-list/sales-agent-list.component').then(
            (m) => m.SalesAgentListComponent
          ),
      },
      {
        path: 'admin-settings',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/admin-settings/admin-settings.component').then(
                (m) => m.AdminSettingsComponent
              ),
          },
          {
            path: 'meta-integration/callback',
            loadComponent: () =>
              import(
                './features/admin-settings/meta-integration/meta-integration-callback.component'
              ).then((m) => m.MetaIntegrationCallbackComponent),
          },
        ],
      },
      { path: '**', redirectTo: 'monitor' },
    ],
  },
];

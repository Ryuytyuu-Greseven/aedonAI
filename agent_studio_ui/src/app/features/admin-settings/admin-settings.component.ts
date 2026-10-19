import { Component } from '@angular/core';
import { MetaIntegrationComponent } from './meta-integration/meta-integration.component';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [MetaIntegrationComponent],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
})
export class AdminSettingsComponent {}

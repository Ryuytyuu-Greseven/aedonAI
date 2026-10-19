import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { REALTIME_TRANSPORT } from './core/realtime/realtime-transport';
import { MockRealtimeTransport } from './core/realtime/mock-realtime-transport';
import { RealtimeService } from './core/realtime/realtime.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: REALTIME_TRANSPORT, useClass: MockRealtimeTransport },
    provideAppInitializer(() => firstValueFrom(inject(AuthService).validateSession())),
    provideAppInitializer(() => {
      inject(RealtimeService).connect();
    }),
  ],
};

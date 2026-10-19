import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Aedon AI — Voice agents that sell, support and follow up' },
  {
    path: 'solutions',
    loadComponent: () => import('./pages/solutions/solutions.component').then((m) => m.SolutionsComponent),
    title: 'Solutions · Aedon AI',
  },
  {
    path: 'solutions/:slug',
    loadComponent: () => import('./pages/solution-detail/solution-detail.component').then((m) => m.SolutionDetailComponent),
    title: 'Solution · Aedon AI',
  },
  {
    path: 'platform',
    loadComponent: () => import('./pages/platform/platform.component').then((m) => m.PlatformComponent),
    title: 'Platform · Aedon AI',
  },
  {
    path: 'pricing',
    loadComponent: () => import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
    title: 'Pricing · Aedon AI',
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    title: 'Book a demo · Aedon AI',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Not found · Aedon AI',
  },
];

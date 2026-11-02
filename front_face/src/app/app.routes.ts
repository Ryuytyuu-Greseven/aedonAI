import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Lyre AI — Voice agents that sell, support and follow up' },
  {
    path: 'solutions',
    loadComponent: () => import('./pages/solutions/solutions.component').then((m) => m.SolutionsComponent),
    title: 'Solutions · Lyre AI',
  },
  {
    path: 'solutions/:slug',
    loadComponent: () => import('./pages/solution-detail/solution-detail.component').then((m) => m.SolutionDetailComponent),
    title: 'Solution · Lyre AI',
  },
  {
    path: 'platform',
    loadComponent: () => import('./pages/platform/platform.component').then((m) => m.PlatformComponent),
    title: 'Platform · Lyre AI',
  },
  {
    path: 'pricing',
    loadComponent: () => import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
    title: 'Pricing · Lyre AI',
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    title: 'Book a demo · Lyre AI',
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Not found · Lyre AI',
  },
];

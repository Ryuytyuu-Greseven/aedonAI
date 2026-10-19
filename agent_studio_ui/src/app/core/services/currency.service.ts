import { Injectable, signal } from '@angular/core';

export type CurrencyCode = 'USD' | 'INR' | 'AED';

const STORAGE_KEY = 'lyreai-currency';

// Fixed conversion rates from the canonical storage currency (USD). Mock values —
// swap for live rates once a rates feed is wired up.
const EXCHANGE_RATES_FROM_USD: Record<CurrencyCode, number> = {
  USD: 1,
  INR: 83,
  AED: 3.67,
};

const LOCALES: Record<CurrencyCode, string> = {
  USD: 'en-US',
  INR: 'en-IN',
  AED: 'en-AE',
};

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  readonly currencies: readonly CurrencyCode[] = ['USD', 'INR', 'AED'];

  readonly currency = signal<CurrencyCode>(this.loadCurrency());

  setCurrency(currency: CurrencyCode): void {
    this.currency.set(currency);
    localStorage.setItem(STORAGE_KEY, currency);
  }

  // All costs are stored in USD; this converts + formats into whichever currency
  // is currently active application-wide.
  format(amountUsd: number): string {
    const currency = this.currency();
    const converted = amountUsd * EXCHANGE_RATES_FROM_USD[currency];
    return new Intl.NumberFormat(LOCALES[currency], { style: 'currency', currency }).format(converted);
  }

  // Reads the persisted user override. Once a backend-driven org-level currency
  // config exists, this is where it gets fetched instead of read from localStorage.
  private loadCurrency(): CurrencyCode {
    const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (stored === 'USD' || stored === 'INR' || stored === 'AED') {
      return stored;
    }
    return 'USD';
  }
}

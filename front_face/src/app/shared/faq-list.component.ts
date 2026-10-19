import { Component, signal } from '@angular/core';
import { FAQS } from '../data/content.data';

@Component({
  selector: 'app-faq-list',
  template: `
    <div class="faqs">
      @for (faq of faqs; track faq.question; let i = $index) {
        <div class="faq" [class.open]="open() === i">
          <button type="button" (click)="open.set(open() === i ? null : i)" [attr.aria-expanded]="open() === i">
            {{ faq.question }}
            <i class="fa-solid fa-plus"></i>
          </button>
          <div class="answer"><p>{{ faq.answer }}</p></div>
        </div>
      }
    </div>
  `,
  styles: `
    .faqs { max-width: 800px; margin: 0 auto; display: grid; gap: 12px; }
    .faq { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); transition: border-color var(--t-fast); }
    .faq.open { border-color: var(--border-strong); }
    button {
      width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px;
      padding: 20px 22px; border: 0; background: none; cursor: pointer; text-align: left;
      font-weight: 600; font-size: 1rem;
    }
    button i { color: var(--text-faint); transition: transform var(--t); }
    .open button i { transform: rotate(45deg); color: var(--brand-2); }
    .answer { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--t); }
    .answer p { overflow: hidden; margin: 0; padding: 0 22px; color: var(--text-muted); }
    .open .answer { grid-template-rows: 1fr; }
    .open .answer p { padding-bottom: 20px; }
  `,
})
export class FaqListComponent {
  readonly faqs = FAQS;
  readonly open = signal<number | null>(0);
}

import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DemoRequestService } from '../../core/demo-request.service';
import { DemoRequest } from '../../core/models';
import { SOLUTIONS } from '../../data/solutions.data';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink, RevealDirective],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent implements OnInit {
  /** Optional `?industry=` / `?plan=` query params used to prefill the form. */
  readonly industry = input<string>();
  readonly plan = input<string>();

  readonly solutions = SOLUTIONS;
  readonly volumes = ['Under 1,000', '1,000 – 10,000', '10,000 – 50,000', '50,000+'];
  readonly submitting = signal(false);
  readonly reference = signal<string | null>(null);

  readonly perks = [
    { icon: 'fa-headset', text: 'A live call with an agent built for your use-case' },
    { icon: 'fa-chart-simple', text: 'ROI estimate based on your call volume' },
    { icon: 'fa-rocket', text: 'A pilot plan to go live within a week' },
  ];

  private readonly fb = inject(FormBuilder);
  private readonly demoRequests = inject(DemoRequestService);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    company: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s-]{7,16}$/)]],
    industry: [''],
    monthlyCalls: [''],
    message: [''],
  });

  ngOnInit(): void {
    const industry = this.industry();
    if (industry && SOLUTIONS.some((s) => s.slug === industry)) this.form.patchValue({ industry });
    const plan = this.plan();
    if (plan) this.form.patchValue({ message: `I'm interested in the ${plan} plan.` });
  }

  invalid(control: keyof DemoRequest): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.demoRequests.submit(this.form.getRawValue()).subscribe(({ reference }) => {
      this.submitting.set(false);
      this.reference.set(reference);
    });
  }

  reset(): void {
    this.form.reset();
    this.reference.set(null);
  }
}

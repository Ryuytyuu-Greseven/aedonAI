import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SOLUTIONS } from '../../data/solutions.data';
import { LogoComponent } from '../logo.component';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, LogoComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  readonly solutions = SOLUTIONS;
  readonly year = new Date().getFullYear();
}

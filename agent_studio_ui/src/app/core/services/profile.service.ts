import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { UserProfile } from '../models/profile.model';
import { Company } from '../models/company.model';
import { ApiService } from '../http/api.service';

export interface MyProfile {
  profile: UserProfile;
  company: Company | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);

  getMyProfile(): Observable<MyProfile> {
    return this.api.getUserProfile().pipe(
      map(({ user, company }) => ({
        profile: { name: user.name, email: user.email },
        company,
      })),
    );
  }

  updateMyProfile(name: string): Observable<UserProfile> {
    return this.api.updateProfileName(name).pipe(map((user) => ({ name: user.name, email: user.email })));
  }
}

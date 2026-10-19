import { Company } from './company.model';

/** Wire shape of the `user` object in `GET /api/users/profile` and `PATCH /api/users/profile/name`. */
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  isDisabled: boolean;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response of `GET /api/users/profile` — real backend, any role. */
export interface UserProfileResponse {
  user: ApiUser;
  company: Company | null;
}

export interface UserProfile {
  name: string;
  email: string;
}

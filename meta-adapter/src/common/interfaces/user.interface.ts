export type UserRole = 'admin' | 'agent';

/** Authenticated request user, resolved from a valid JWT plus a live DB lookup. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
}

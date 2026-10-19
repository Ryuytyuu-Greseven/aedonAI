export type UserRole = 'admin' | 'agent';

export interface AuthSession {
  email: string;
  name: string;
  token: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}

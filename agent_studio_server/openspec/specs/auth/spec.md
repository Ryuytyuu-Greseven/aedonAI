# Capability: Auth

## Purpose

Email/password login and session management for the AedonAI Agent Builder frontend (`../builder_config`). Backs `AuthService` and every route guarded by `auth.guard.ts`. Implemented per `../builder_config/backend-openspec/specs/auth/spec.md`.

---

## Requirements

### Requirement: Login
The system SHALL authenticate a user by email and password and issue a JWT bound to a unique token id (`jti`).

#### Scenario: Successful login
- **WHEN** `POST /api/auth/login` is called with an email/password matching a stored user record (password checked via bcrypt)
- **THEN** the system returns `200 { email, token }`

#### Scenario: Bad credentials
- **WHEN** `POST /api/auth/login` is called with an email/password that doesn't match any user
- **THEN** the system returns `401 { message: "Invalid email or password" }`

### Requirement: Logout Revokes The Token
The system SHALL make a logged-out token unusable server-side, not just rely on the client discarding it.

#### Scenario: Logout then reuse
- **WHEN** an authenticated user calls `POST /api/auth/logout` and then makes another request with the same token
- **THEN** the first call returns `204`, and the reused token is rejected with `401` on any subsequent guarded request

### Requirement: Session Validation
The system SHALL provide a way to validate a stored token server-side on page reload, rather than trusting `localStorage` indefinitely.

#### Scenario: Valid session
- **WHEN** `GET /api/auth/session` is called with a valid, non-revoked, non-expired bearer token
- **THEN** the system returns `200 { email }`

#### Scenario: Invalid or expired session
- **WHEN** `GET /api/auth/session` is called with a missing, expired, or revoked token
- **THEN** the system returns `401`

### Requirement: Seeded Account
The system SHALL ensure at least one user account exists on first boot, since no self-service signup flow exists yet.

#### Scenario: Fresh database
- **WHEN** the server starts and no user matches `ADMIN_EMAIL`
- **THEN** the system creates a user with `ADMIN_EMAIL`/`ADMIN_PASSWORD` (bcrypt-hashed), defaulting to `test@test.com` / `admin123` to match the legacy frontend mock

---

## Open decisions (unchanged from backend-openspec)

- Real signup/multi-tenancy/SSO model — not built; single seeded account only.
- Token expiry is fixed via `JWT_EXPIRES_IN`; no refresh-token flow yet.

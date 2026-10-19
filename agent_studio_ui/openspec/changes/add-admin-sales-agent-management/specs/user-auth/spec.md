## MODIFIED Requirements

### Requirement: Authentication API
The system SHALL authenticate credentials against the real backend (`POST /api/auth/login`, see `logins.md`), which returns each account's `role` (`admin` or `agent`). Additional `agent` accounts may be created by an admin via the Sales Agents screen (see `sales-agent-accounts` capability) and are authenticated the same way. The established session SHALL include the account's `role`.

#### Scenario: Successful agent login
- **WHEN** a user submits credentials for an `agent` account
- **THEN** the backend issues a session token and the frontend establishes an authenticated session with `role: 'agent'` and navigates to `/monitor`

#### Scenario: Successful admin login
- **WHEN** a user submits credentials for an `admin` account
- **THEN** the backend issues a session token and the frontend establishes an authenticated session with `role: 'admin'` and navigates to `/monitor` — the same landing screen as an agent

#### Scenario: Invalid credentials
- **WHEN** the user submits any email/password combination that does not match a known account
- **THEN** the backend returns 401 and the system shows an authentication error and keeps the user on `/login`

#### Scenario: Disabled agent account
- **WHEN** the user submits credentials belonging to an `agent` account an admin has disabled
- **THEN** the backend returns 401 and the system shows an authentication error and keeps the user on `/login`

### Requirement: Route Protection
The system SHALL block rendering of all application screens until a valid session exists. Both `role: 'agent'` and `role: 'admin'` sessions may reach every existing application screen (dashboard, playground, monitor, knowledge base, phone numbers, agent builder) identically. Additionally, the system SHALL restrict the Sales Agents screen (`/admin`) to `role: 'admin'` sessions only. The system SHALL NOT render a disallowed screen even momentarily during the auth/role check.

#### Scenario: Guarded navigation for agent
- **WHEN** a session with `role: 'agent'` navigates to `/dashboard`, `/playground`, `/monitor`, `/knowledge-base`, `/phone-numbers`, or `/agents/:id`
- **THEN** the system renders the requested screen normally

#### Scenario: Guarded navigation for admin
- **WHEN** a session with `role: 'admin'` navigates to `/dashboard`, `/playground`, `/monitor`, `/knowledge-base`, `/phone-numbers`, or `/agents/:id`
- **THEN** the system renders the requested screen normally, identically to an agent session

#### Scenario: Admin reaches the Sales Agents screen
- **WHEN** a session with `role: 'admin'` navigates to `/admin`
- **THEN** the system renders the Sales Agents screen

#### Scenario: Agent blocked from the Sales Agents screen
- **WHEN** a session with `role: 'agent'` navigates to `/admin`
- **THEN** the system redirects them to `/monitor` and does not render the Sales Agents screen

#### Scenario: Unauthenticated user visits any route
- **WHEN** a user with no active session navigates to `/`, `/dashboard`, `/admin`, `/agents/new`, or `/agents/:id`
- **THEN** the system redirects them to `/login` and does not render the requested screen

#### Scenario: Session cleared mid-session
- **WHEN** an authenticated user's session is cleared (e.g., via logout, or the backend rejects a request with 401 because the account was disabled or the token was revoked) and they attempt to navigate to a protected route
- **THEN** the system redirects them to `/login`

### Requirement: Authenticated User Redirect From Login
The system SHALL redirect an already-authenticated user away from `/login` to `/monitor` instead of showing the login form again, regardless of role.

#### Scenario: Authenticated user visits /login
- **WHEN** a user with an active session (either role) navigates directly to `/login`
- **THEN** the system redirects them to `/monitor`

## ADDED Requirements

### Requirement: Session Restore Refreshes Identity
The system SHALL, on app startup, validate the persisted session against the real backend (`GET /api/auth/session`) and refresh the session's `email`/`name`/`role` from the response — since the backend resolves role fresh on every request, a role change or rename an admin makes elsewhere takes effect on the user's very next reload rather than requiring a fresh login.

#### Scenario: Role changed since last login
- **WHEN** an admin changes a currently-logged-in agent's role or disables their account, and that agent reloads the app
- **THEN** the frontend's session reflects the change immediately (redirected to `/login` if now disabled/invalid, or gated accordingly if role changed)

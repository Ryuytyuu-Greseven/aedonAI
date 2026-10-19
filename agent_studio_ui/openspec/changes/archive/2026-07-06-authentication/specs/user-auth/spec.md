## ADDED Requirements

### Requirement: Login Screen
The system SHALL present a login screen at `/login` with email and password fields and a submit action, before any other route is reachable by an unauthenticated user.

#### Scenario: Unauthenticated user visits any route
- **WHEN** a user with no active session navigates to `/`, `/dashboard`, `/agents/new`, or `/agents/:id`
- **THEN** the system redirects them to `/login` and does not render the requested screen

#### Scenario: Login form validation
- **WHEN** the user submits the login form with an empty email or password field
- **THEN** the system shows a validation error and does not attempt authentication

### Requirement: Mock Authentication API
The system SHALL authenticate credentials via a simulated asynchronous API call (mock service with artificial latency) that validates against a single known account: email `test@test.com`, password `admin123`.

#### Scenario: Successful login
- **WHEN** the user submits `test@test.com` / `admin123`
- **THEN** the system simulates an API call, then establishes an authenticated session and navigates to `/dashboard`

#### Scenario: Invalid credentials
- **WHEN** the user submits any email/password combination other than `test@test.com` / `admin123`
- **THEN** the system simulates an API call, then shows an authentication error and keeps the user on `/login`

### Requirement: Session Persistence
The system SHALL persist the authenticated session in browser `localStorage` so that reloading the page keeps the user logged in without re-entering credentials.

#### Scenario: Reload after login
- **WHEN** an authenticated user reloads the page
- **THEN** the system restores the session from `localStorage` and shows the previously accessible screen instead of `/login`

#### Scenario: No session on fresh visit
- **WHEN** a user with no stored session opens the app for the first time
- **THEN** the system treats them as unauthenticated and shows `/login`

### Requirement: Route Protection
The system SHALL block rendering of all existing application screens (dashboard, agent builder) until a valid session exists, and SHALL NOT render those screens even momentarily during the auth check.

#### Scenario: Guarded navigation
- **WHEN** an authenticated user navigates to `/dashboard` or `/agents/:id`
- **THEN** the system renders the requested screen normally

#### Scenario: Session cleared mid-session
- **WHEN** an authenticated user's session is cleared (e.g., via logout) and they attempt to navigate to a protected route
- **THEN** the system redirects them to `/login`

### Requirement: Logout
The system SHALL provide a logout action that clears the current session and returns the user to the login screen.

#### Scenario: User logs out
- **WHEN** an authenticated user triggers logout
- **THEN** the system clears the persisted session and navigates to `/login`

### Requirement: Authenticated User Redirect From Login
The system SHALL redirect an already-authenticated user away from `/login` to `/dashboard` instead of showing the login form again.

#### Scenario: Authenticated user visits /login
- **WHEN** a user with an active session navigates directly to `/login`
- **THEN** the system redirects them to `/dashboard`

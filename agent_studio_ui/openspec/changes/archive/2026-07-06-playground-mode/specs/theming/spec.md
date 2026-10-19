## MODIFIED Requirements

### Requirement: Dark / Light Mode Toggle

The system SHALL provide a persistent toggle that switches between Dark and Light mode. The user's preference SHALL be stored in `localStorage` and restored on next visit. The toggle SHALL be accessible from any page via a standalone control fixed to the top-right of the viewport, independent of the primary navigation rail/flyout.

#### Scenario: User toggles to dark mode
- **WHEN** the user clicks the top-right theme toggle
- **THEN** `data-theme="dark"` is set on `<html>`, all token values update immediately (no page reload), and the preference is saved to `localStorage`

#### Scenario: Returning user with saved preference
- **WHEN** the application loads
- **THEN** it reads `localStorage` for the saved theme and applies it before the first render, preventing a flash of the opposite theme

#### Scenario: System preference fallback
- **WHEN** no saved preference exists in `localStorage`
- **THEN** the application respects `prefers-color-scheme` media query as the initial theme

### Requirement: Responsive Breakpoints

The system SHALL define four named breakpoints as CSS custom properties and SCSS/CSS variables: `xs` (< 480 px), `sm` (480–767 px), `md` (768–1199 px), `lg` (≥ 1200 px). Layout shifts SHALL only occur at these breakpoints.

#### Scenario: Narrow viewport
- **WHEN** viewport width is below 768 px
- **THEN** the right-edge navigation rail stays icon-only by default and its hover flyout becomes tap-to-toggle (per the nav-shell touch fallback), and the main content occupies the full available width

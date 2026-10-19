# Capability: Theming

## Purpose

Establish the global visual foundation for the LyreAI builder. All colors, spacing, typography, and layout tokens are defined once as CSS custom properties and Angular-level global styles. No component may redeclare a value already available as a token. The system must support a user-toggled Dark and Light mode that propagates instantly across the entire application.

---

## Requirements

### Requirement: Global CSS Custom Properties

The system SHALL define all design tokens as CSS custom properties on `:root` (light) and `[data-theme="dark"]` (dark), covering colors, spacing, border-radius, shadow, typography scale, and z-index layers. No component stylesheet may hard-code a color or spacing value.

#### Scenario: Token override for dark mode
- **WHEN** `data-theme="dark"` is set on `<html>`
- **THEN** all `var(--color-*)`, `var(--bg-*)`, and `var(--text-*)` tokens resolve to their dark-mode values without any component change

#### Scenario: Missing token fallback
- **WHEN** a component references a token that does not exist in the design system
- **THEN** the browser applies the fallback value declared inline in the `var()` call, and a lint warning is raised in development

---

### Requirement: Global Utility Classes

The system SHALL provide a set of global CSS utility classes for layout (flex, grid, gap), typography (headings, body, labels, captions), status colors (success, warning, error, info), and surface elevations (card, panel, overlay). Components SHALL use these classes rather than duplicating the styles.

#### Scenario: Using a utility class
- **WHEN** a component template applies `class="card surface-1"`
- **THEN** the element receives background, border, border-radius, and box-shadow from the global stylesheet without any local CSS

---

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

---

### Requirement: Angular Material / CDK Integration

The system SHALL integrate Angular's global styles (reset, typography) and, if a component library is used, override its theme tokens to align with the LyreAI design tokens. No inline `style` attributes shall be used on host elements.

#### Scenario: Component library theming
- **WHEN** a component from the library is rendered
- **THEN** its colors and fonts match the active LyreAI theme tokens without per-component overrides

---

### Requirement: Responsive Breakpoints

The system SHALL define four named breakpoints as CSS custom properties and SCSS/CSS variables: `xs` (< 480 px), `sm` (480–767 px), `md` (768–1199 px), `lg` (≥ 1200 px). Layout shifts SHALL only occur at these breakpoints.

#### Scenario: Narrow viewport
- **WHEN** viewport width is below 768 px
- **THEN** the right-edge navigation rail stays icon-only by default and its hover flyout becomes tap-to-toggle (per the nav-shell touch fallback), and the main content occupies the full available width

#### Scenario: Desktop and large-monitor viewport
- **WHEN** viewport width is at or above the `lg` breakpoint (≥ 1200 px), including large/ultrawide monitors
- **THEN** page content scales up to use the additional width rather than staying flat at a small fixed column, up to a bounded, content-type-appropriate maximum: card/grid gallery pages (e.g. Dashboard, Monitor Agents list) reflow their existing responsive grids into more columns, data-dense pages (e.g. Monitor Detail's stats, chart, and call log table) widen up to a larger cap, and single-column form/editor pages (e.g. Playground editor) keep a readability-focused cap rather than stretching to full width

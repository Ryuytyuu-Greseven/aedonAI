# Capability: Nav Shell

## Purpose

The Nav Shell is the application's primary navigation chrome: a right-edge hover flyout for moving between top-level sections, a persistent top-right theme toggle, and a hexagon avatar exposing the current session and logout. It replaces the earlier top-header shell for all authenticated screens.

---

## Requirements

### Requirement: Right-Edge Hover Flyout Navigation
The system SHALL present primary navigation as a slim, always-visible rail fixed to the right edge of the viewport, showing icons only. On pointer hover, the rail SHALL expand into a flyout panel showing icon + label for each destination (Dashboard, Playground, Monitor Agents, Knowledge Base, Phone Numbers). Moving the pointer off the flyout SHALL collapse it back to the icon-only rail.

#### Scenario: Hovering the collapsed rail
- **WHEN** a mouse pointer enters the right-edge rail
- **THEN** the rail expands into a flyout panel with labeled navigation entries, without shifting page content underneath it

#### Scenario: Pointer leaves the flyout
- **WHEN** the pointer leaves the expanded flyout area
- **THEN** the flyout collapses back to the icon-only rail within the existing theme transition duration

#### Scenario: Touch device fallback
- **WHEN** the app is used on a device with no hover capability (`(hover: none)`)
- **THEN** tapping the rail toggles the flyout open/closed instead of relying on hover

#### Scenario: Active destination indicator
- **WHEN** the current route matches a nav destination
- **THEN** that destination is visually marked active in both the collapsed rail (icon) and expanded flyout (icon + label)

#### Scenario: Navigating to Monitor Agents
- **WHEN** the user clicks the "Monitor Agents" entry in the flyout
- **THEN** the router navigates to `/monitor` and that entry is marked active

#### Scenario: Navigating to Phone Numbers
- **WHEN** the user clicks the "Phone Numbers" entry in the flyout
- **THEN** the router navigates to `/phone-numbers` and that entry is marked active

### Requirement: Persistent Top-Right Theme Toggle
The system SHALL display the dark/light theme toggle as a standalone control fixed to the top-right of the viewport, independent of the right-edge navigation rail/flyout.

#### Scenario: Toggling theme from any screen
- **WHEN** the user clicks the top-right theme toggle on any route
- **THEN** the theme switches immediately via the existing `ThemeService`, consistent with current dark/light behavior

### Requirement: Hexagon Profile Avatar
The system SHALL display a hexagonal avatar showing the first letter of the current session's identity in the top-right area, near the theme toggle. On hover, it SHALL expand to a profile panel showing the full session email and a logout action.

#### Scenario: Collapsed avatar
- **WHEN** the pointer is not hovering the avatar
- **THEN** only the hexagon with the first letter of the session email is visible

#### Scenario: Hovering the avatar
- **WHEN** the pointer hovers the hexagon avatar
- **THEN** a panel expands showing the full session email and a "Log out" action

#### Scenario: Logging out from the profile panel
- **WHEN** the user clicks "Log out" in the expanded profile panel
- **THEN** the session is cleared via `AuthService.logout()` and the user is redirected to `/login`, matching existing logout behavior

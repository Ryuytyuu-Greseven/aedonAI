## MODIFIED Requirements

### Requirement: Right-Edge Hover Flyout Navigation
The system SHALL present primary navigation as a slim, always-visible rail fixed to the right edge of the viewport, showing icons only, for both `sales_agent` and `admin` sessions identically. On pointer hover, the rail SHALL expand into a flyout panel showing icon + label for each destination (Dashboard, Playground, Monitor Agents, Knowledge Base, Phone Numbers). For a session with `role: 'admin'`, the flyout SHALL additionally show a "Sales Agents" destination linking to `/admin`, which a `sales_agent` session SHALL NOT see. Moving the pointer off the flyout SHALL collapse it back to the icon-only rail.

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

#### Scenario: Admin sees the Sales Agents destination
- **WHEN** a session with `role: 'admin'` hovers the flyout
- **THEN** a "Sales Agents" entry is shown alongside the existing destinations, and clicking it navigates to `/admin`

#### Scenario: Sales agent does not see the Sales Agents destination
- **WHEN** a session with `role: 'sales_agent'` hovers the flyout
- **THEN** no "Sales Agents" entry (and no other link to `/admin`) is present anywhere in the nav shell

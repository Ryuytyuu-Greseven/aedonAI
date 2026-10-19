## ADDED Requirements

### Requirement: Call Log Tab
The system SHALL provide a "Call Log" tab in the Monitor Detail page, alongside the existing Overview and Reports tabs, giving access to the per-call log table and detail view described by the `call-log-detail` capability.

#### Scenario: Navigating to the Call Log tab
- **WHEN** the user opens an agent's Monitor Detail page and clicks "Call Log"
- **THEN** the Overview/Reports content is replaced by the call log table for that agent, per the `call-log-detail` capability

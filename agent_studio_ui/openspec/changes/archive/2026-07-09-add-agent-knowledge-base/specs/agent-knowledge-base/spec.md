## ADDED Requirements

### Requirement: Knowledge Base Entry List
The system SHALL display a list of the agent's knowledge base entries (files and reference URLs together), each showing: an icon distinguishing its type, its name, type-specific metadata (file type and size for files; the URL for links), and when it was added.

#### Scenario: Viewing a populated knowledge base
- **WHEN** the user opens the Knowledge Base panel for an agent with existing entries
- **THEN** each entry is listed with its icon, name, metadata, and added date

#### Scenario: Empty knowledge base
- **WHEN** the agent has no knowledge base entries yet
- **THEN** an empty state is shown explaining these are reference materials being catalogued for the agent, with controls to add a file or a URL

### Requirement: Add Multiple Files
The system SHALL allow the user to select and add multiple files at once (PDF, DOC, DOCX, TXT, CSV, MD), each becoming a separate knowledge base entry capturing the file's name, extension, and size. The system SHALL NOT read, store, or transmit file contents.

#### Scenario: Adding multiple files in one selection
- **WHEN** the user selects 3 files at once via "Add Files"
- **THEN** 3 new entries appear in the list, each with the correct file name, type, and size

#### Scenario: Selecting an unsupported file type
- **WHEN** the user's file picker is restricted to PDF/DOC/DOCX/TXT/CSV/MD via the file input's accepted types
- **THEN** unsupported file types are not selectable through the picker

### Requirement: Add Reference URL
The system SHALL allow the user to add a reference URL entry with a required label and a required URL value that must look like a valid `http(s)://` URL.

#### Scenario: Adding a valid URL
- **WHEN** the user enters a label and a valid `https://` URL and confirms
- **THEN** a new entry with `kind: url` appears in the list showing the label and URL

#### Scenario: Adding an invalid URL
- **WHEN** the user enters a value that is not a valid `http(s)://` URL
- **THEN** an inline validation error is shown and no entry is added

### Requirement: Duplicate Name Prevention
The system SHALL prevent adding a file or URL entry whose name matches an existing entry's name (case-insensitive), across both files and URLs in the same list.

#### Scenario: Duplicate file name
- **WHEN** the user adds a file whose name matches an existing entry's name
- **THEN** an inline error is shown and the duplicate is not added

#### Scenario: URL label matching an existing file name
- **WHEN** the user adds a URL entry whose label matches an existing file entry's name
- **THEN** an inline error is shown and the duplicate is not added

### Requirement: Remove Knowledge Base Entry
The system SHALL allow the user to remove any knowledge base entry via a delete action gated by a confirmation dialog.

#### Scenario: Deleting an entry
- **WHEN** the user clicks delete on an entry and confirms
- **THEN** the entry is removed from the list

#### Scenario: Cancelling a delete
- **WHEN** the user clicks delete on an entry but cancels the confirmation
- **THEN** the entry remains in the list

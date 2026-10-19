## MODIFIED Requirements

### Requirement: Knowledge Base Entry List
The system SHALL display a list of a knowledge base's entries (files and reference URLs together), each showing: an icon distinguishing its type, its name, type-specific metadata (file type and size for files; the URL for links), and when it was added. A knowledge base is a standalone, shareable entity per the `knowledge-base-library` capability — this entry list is used both in the Knowledge Base detail page and inline in the Playground editor when managing a linked knowledge base.

#### Scenario: Viewing a populated knowledge base
- **WHEN** the user opens a knowledge base's entry list, whether from the Knowledge Base detail page or expanded inline in Playground
- **THEN** each entry is listed with its icon, name, metadata, and added date

#### Scenario: Empty knowledge base
- **WHEN** a knowledge base has no entries yet
- **THEN** an empty state is shown explaining these are reference materials being catalogued, with controls to add a file or a URL

# LyreAI Builder Config

This repository uses the **OpenSpec** framework (`openspec` CLI v1.4.1) to manage feature development through structured, spec-driven changes.

## OpenSpec Workflow

OpenSpec organizes work into **changes** — each change has a set of artifacts (proposal, design, specs, tasks) generated and tracked by the CLI.

### Commands

| Command | What it does |
|---|---|
| `/project:opsx-propose` | Create a new change with all artifacts in one step |
| `/project:opsx-apply` | Implement tasks from a change |
| `/project:opsx-explore` | Enter thinking/exploration mode before committing |
| `/project:opsx-sync` | Sync delta specs from a change into main specs |
| `/project:opsx-archive` | Finalize and archive a completed change |

### Typical flow

```
explore → propose → apply → sync → archive
```

1. **Explore** — think through the idea before committing (`/project:opsx-explore`)
2. **Propose** — generate proposal, design, and tasks (`/project:opsx-propose <name>`)
3. **Apply** — implement the tasks (`/project:opsx-apply <name>`)
4. **Sync** — merge delta specs into main specs (`/project:opsx-sync <name>`)
5. **Archive** — finalize the change (`/project:opsx-archive <name>`)

### Key directories

- `openspec/` — OpenSpec config and main specs
- `openspec/specs/<capability>/spec.md` — Main requirement specs per capability
- `openspec/config.yaml` — Project schema configuration (currently `spec-driven`)

### CLI reference

```bash
openspec list --json              # List active changes
openspec status --change <name> --json   # Get change status and artifact paths
openspec instructions <artifact> --change <name> --json  # Get artifact creation instructions
openspec new change <name>        # Create a new change
```

# New Project Template

A reusable project template for building Cloudflare Developer Platform products using an AI-assisted workflow. The idea is to go from a raw product idea to a technical PRD to working code, with an LLM as your collaborator at every step.

## How it works

1. **Write your idea** in `design/initial-idea.md`
2. **Run `/kickoff`** — the LLM reads your idea and asks clarifying questions (Discovery phase)
3. **Say "generate PRD"** — the LLM writes a structured PRD to `design/prd.md`
4. **Write change requests** in `design/change-request.md` as you iterate
5. **Run `/change`** — the LLM implements the requests, updates the PRD, and logs everything
6. **Starting a new session?** Run `/resume` first to get the LLM up to speed, then `/change`

Every decision, change, and its rationale lives in files — not buried in chat history.

## Project structure

```
project-root/
├── .opencode/
│   └── commands/
│       ├── kickoff.md            /kickoff — start PRD discovery
│       ├── resume.md             /resume  — catch up a new LLM session
│       ├── change.md             /change  — implement change requests
│       └── push.md               /push    — push code to remote repository
├── design/
│   ├── rules.md                  repository rules for the LLM
│   ├── prd-creator.md            instructions and PRD format for the LLM
│   ├── initial-idea.md           your raw product idea (you create this)
│   ├── prd.md                    generated PRD (kept up to date)
│   ├── change-request.md         outstanding and finalized change requests
│   ├── changelog.md              log of all code changes
│   ├── references/               context for the LLM (screenshots, logs, mockups)
│   └── assets/                   app files for the LLM to integrate (originals stay here)
├── manual-prompts.md             copy-paste prompts for non-OpenCode tools
└── src/
    └── ...                       implemented code
```

## OpenCode commands

This template includes four custom [OpenCode](https://opencode.ai) commands in `.opencode/commands/`:

### `/kickoff`

Starts the PRD discovery phase. The LLM reads `design/prd-creator.md` and `design/initial-idea.md`, then asks you clarifying questions before proposing anything. When you're satisfied, say "generate PRD" and it writes the output to `design/prd.md`.

### `/resume`

Catches up a new LLM session on the current project state. The LLM reads the PRD, changelog, and change requests, then explores the existing code in `src/`. It gives you a summary of what's been built, what's outstanding, and any questions — without making changes until you say so. Run this at the start of every new session before `/change`.

### `/change`

Processes outstanding change requests. The LLM reads the current PRD and `design/change-request.md`, implements each request, updates the PRD and `README.md`, moves completed requests to the Finalized section, and logs everything to `design/changelog.md`.

### `/push`

Pushes code to the remote repository. The LLM will never push code unless you explicitly run this command. On first push, it asks for the repository URL. Before every push, it audits the project directory for passwords, secrets, API keys, and tokens — and stops if anything is found.

## Using without OpenCode

If you're using Cursor, Claude, ChatGPT, or any other tool, copy and paste the prompts from `manual-prompts.md` instead.

## Getting started

```bash
git clone https://github.com/jdores/new-project-template.git my-new-project
cd my-new-project
```

Then:
1. Edit `design/initial-idea.md` with your product idea
2. Open OpenCode and run `/kickoff`

## Key conventions

- **`design/references/`** is for context only (screenshots, logs, mockups) — these files are never deployed
- **`design/assets/`** is for app files the LLM should integrate into the project — originals always stay here
- **`design/prd.md`** is always kept up to date — it represents the current spec, not the original
- **`design/changelog.md`** tracks every code change with timestamps, files modified, and linked requirements
- **`design/change-request.md`** uses numbered IDs (CR-001, CR-002, ...) with priority, description, and acceptance criteria
- **`design/rules.md`** defines repository rules the LLM must always follow (MIT license, secrets audit, push policy)
- Code is **never pushed** without an explicit `/push` command
- All projects use the **MIT License**

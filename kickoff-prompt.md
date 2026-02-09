# Kickoff Prompt

> **Note:** This file is kept as a reference. If you're using OpenCode, use the `/kickoff` and `/change` commands instead — they do the same thing automatically.

## Starting the PRD discovery

In OpenCode, type:

```
/kickoff
```

Or copy and paste this as your first message to any LLM:

---

Read the following two files:
- `design/prd-creator.md` — your instructions, PRD format, and behavioral rules
- `design/initial-idea.md` — my product idea

Follow the process and rules defined in `design/prd-creator.md`.

Start with the Discovery phase — ask me clarifying questions before proposing anything. When I'm satisfied with the direction, I'll say "generate PRD" and you should write the output to `design/prd.md`.

---

## Processing change requests

In OpenCode, type:

```
/change
```

Or copy and paste this:

---

Read the following files:
- `design/prd-creator.md` — your instructions and behavioral rules
- `design/prd.md` — the current PRD
- `design/change-request.md` — outstanding change requests to implement

Check `design/references/` for any supporting context referenced in the change requests.
Check `design/assets/` for any app files that need to be integrated into the project (keep originals in place).

Implement the outstanding change requests. For each one:
1. Ask clarifying questions if anything is ambiguous
2. Integrate any files from `design/assets/` into the appropriate destination
3. Implement the code changes in `src/`
4. Update `design/prd.md` to reflect the new state
5. Move the request from **Outstanding** to **Finalized** in `design/change-request.md`
6. Log what you did in `design/changelog.md`

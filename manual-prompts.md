# Manual Prompts

> **Note:** This file is kept as a reference. If you're using OpenCode, use the `/kickoff`, `/resume`, `/change`, and `/push` commands instead — they do the same thing automatically.

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

## Resuming in a new session

In OpenCode, type:

```
/resume
```

Or copy and paste this:

---

Read the following files to understand the current state of this project:
- `design/prd-creator.md` — your instructions and behavioral rules
- `design/rules.md` — repository rules you must follow
- `design/prd.md` — the current PRD
- `design/changelog.md` — log of all changes made so far
- `design/change-request.md` — outstanding and finalized change requests

Then explore the `src/` directory to understand the current codebase — read the key files and familiarize yourself with the project structure, architecture, and implementation patterns already in place.

Once you've reviewed everything, give me a brief summary of:
1. What has been built so far
2. What outstanding change requests remain
3. Any questions you have before continuing

Do not make any changes yet — wait for my instructions.

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
6. Update `README.md` to reflect the current state of the project
7. Log what you did in `design/changelog.md`

---

## Pushing code to remote

In OpenCode, type:

```
/push
```

Or copy and paste this:

---

Before pushing, follow these steps in order:

1. **First push only:** If no remote has been configured yet, ask me for the repository URL and set it up.
2. **Secrets audit:** Scan the entire project directory for passwords, secrets, API keys, tokens, and credentials. Report any findings and stop — do not push until I confirm the issue is resolved.
3. **Push:** If the audit is clean, push the current branch to the remote.

---
description: Push code to the remote repository
---

Before pushing, follow these steps in order:

1. **First push only:** If no remote has been configured yet, ask the user for the repository URL and set it up.
2. **Secrets audit:** Scan the entire project directory for passwords, secrets, API keys, tokens, and credentials. Report any findings and stop — do not push until the user confirms the issue is resolved.
3. **Push:** If the audit is clean, push the current branch to the remote.

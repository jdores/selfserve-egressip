# Repository Rules

Rules the LLM must follow for all code in this repository.

## License

- All projects use the **MIT License**.
- Include a `LICENSE` file in the project root when initializing a new project.

## Git & GitHub

- **Before the first push**, ask the user for the remote repository URL. Do not assume or guess it.
- **Before every push**, audit the entire project directory for passwords, secrets, API keys, tokens, and credentials. This includes:
  - Environment variables with sensitive values (`.env` files, `wrangler.toml` secrets, etc.)
  - Hardcoded strings that look like keys or tokens
  - Any file that should be in `.gitignore` but isn't
- If any secrets are found, **stop and report them** to the user before proceeding. Do not push until the user confirms the issue is resolved.

## .gitignore

- **When adding new dependencies, tools, or file types to the project**, check whether `.gitignore` should be updated and suggest additions to the user. Common patterns to consider:
  - Environment and secrets files (`.env`, `.env.*`, `.dev.vars`)
  - Cloudflare config with secrets (`wrangler.toml`)
  - Key and certificate files (`*.pem`, `*.key`, `credentials.json`)
  - Build artifacts and output directories (`dist/`, `.wrangler/`)
  - OS and editor files (`.DS_Store`, `.vscode/`, `.idea/`)
  - Dependency directories (`node_modules/`)
- Do not modify `.gitignore` without confirming with the user first.

## Push Policy

- **Never push code to a remote repository unless the user explicitly runs the `/push` command.** No exceptions — do not push as part of any other workflow, even if it seems convenient.

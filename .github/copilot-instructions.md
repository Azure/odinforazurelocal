# Copilot Instructions

## Git Operations
- Always use Git CLI commands in the terminal for all git operations
- Do not use MCP tools or other git integrations, such as Kraken
- Do not use pwsh commands for PowerShell 7, as they may not work in all environments
- Use `git status` to check the status of your repository before making any commits
- When updating the version number, ensure that it is updated in all relevant files, such as the `README.md`, `CHANGELOG.md`, and the index.html and What's New section in the java script code.
- When making updates use the Release Branch and create a pull request to merge it into the main branch. Do not commit directly to the main branch. Try to avoid creating additional branches, to prevent merge conflicts and maintain a clean commit history.
- When creating a pull request, ensure that it includes a clear description of the changes made and the reason for the changes. This will help reviewers understand the context of the changes and provide feedback more effectively.
- Before starting new work, always pull the latest changes from the main branch into Release Branch to ensure that you are working with the most up-to-date codebase, fast-forward merge. This will help prevent merge conflicts and ensure that your changes are based on the latest version of the code.
- When adding new release notes to the top of the readme, for each new release, ensure that we move the existing / old versions to only exist in the appendix of the readme, and only the latest version is at the top of the readme. This will help keep the readme organized and make it easier for users to find the latest release notes.
- PRs should be merged manually by the author, after all checks have passed and any necessary approvals have been obtained. Do not use auto-merge features, as they may merge PRs before they are ready or without proper review.

## Security Constraints
- **basic-ftp**: NEVER allow `basic-ftp` to regress below version **5.2.2**. Version 5.2.1 and below have known security vulnerabilities. The override in `package.json` (`"basic-ftp": ">=5.2.2"`) must be maintained. If any dependency change or PR attempts to downgrade this, reject it. (Flagged April 2026 via Dependabot PR #198)

## Coding Standards
- Only make changes directly related to the task. Don't "improve" adjacent code, comments, or formatting, without asking.
- Match the existing code style, even if you'd do it differently.
- No abstractions, helpers, or configurability for single-use code.
- If your changes make imports, variables, or functions unused, remove them. Don't remove pre-existing dead code without asking first, but if you add new dead code, remove it.
- Before implementing, state assumptions. If multiple approaches exist, present the tradeoffs — don't pick silently.
- After making all changes and committing, verify the code by running `node scripts/run-tests.js` to confirm all 806+ tests pass, and that the new code is covered by tests. If you add new functionality, add tests for it.
- If you need to make a breaking change, that would impact users, first raise it in the prompt to discuss it.
- Consider this website is used on mobile devices, so ensure that any changes to the UI are responsive and work well on smaller screens.
- When changes are made to the Designer, or Sizer, ensure that the interactions between them are fully considered and tested, to prevent any unintended consequences or bugs, for example, if you make a change to the Designer, ensure that it does not break any existing functionality in the Sizer, and vice versa.
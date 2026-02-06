# Copilot Instructions

## Git Operations
- Always use Git CLI commands in the terminal for all git operations
- Do not use MCP tools or other git integrations, such as Kraken
- Do not use pwsh commands for PowerShell 7, as they may not work in all environments
- Use `git status` to check the status of your repository before making any commits
- When updating the version number, ensure that it is updated in all relevant files, such as the `README.md`, `CHANGELOG.md`, and the index.html and What's New section in the java script code.
- When making updates use the Release Branch and create a pull request to merge it into the main branch. Do not commit directly to the main branch. Try to avoid creating additional branches, to prevent merge conflicts and maintain a clean commit history.
- When creating a pull request, ensure that it includes a clear description of the changes made and the reason for the changes. This will help reviewers understand the context of the changes and provide feedback more effectively.
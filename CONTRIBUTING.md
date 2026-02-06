# Contributing to ODIN for Azure Local

Thank you for your interest in contributing to ODIN (Optimal Deployment and Infrastructure Navigator) for Azure Local!

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## How to Contribute

### Reporting Issues

- **Bug Reports**: Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) to report issues
- **Feature Requests**: Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) to suggest enhancements
- Search existing issues before creating a new one

### Pull Requests

1. **Fork the repository** and create your branch from `Release`
2. **Make your changes** following the coding standards below
3. **Test your changes** locally using the test server:
   ```powershell
   .\tests\serve.ps1
   # Open http://localhost:5500 in your browser
   ```
4. **Run the test suite** at http://localhost:5500/tests/
5. **Submit a pull request** to the `Release` branch

### Branch Strategy

- `main` - Production branch, deployed to GitHub Pages
- `Release` - Development branch for integrating changes
- Feature branches should be created from and merged to `Release`

## Development Setup

### Prerequisites

- Modern web browser (Edge, Chrome, Firefox, Safari)
- PowerShell (for local test server)
- Node.js 20+ (for running tests in CI)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Azure/odinforazurelocal.git
   cd odinforazurelocal
   ```

2. Start the local server:
   ```powershell
   .\tests\serve.ps1
   ```

3. Open http://localhost:5500 in your browser

### Running Tests

Tests run automatically in GitHub Actions on every PR. To run locally:

1. Start the test server: `.\tests\serve.ps1`
2. Navigate to http://localhost:5500/tests/
3. All tests should pass (green checkmarks)

## Coding Standards

### JavaScript

- Use vanilla JavaScript (no frameworks)
- Follow existing code style and patterns
- Use `const` and `let`, never `var`
- Use meaningful variable and function names
- Add JSDoc comments for public functions

### HTML/CSS

- Use semantic HTML5 elements
- Follow existing CSS variable naming conventions
- Maintain dark/light theme compatibility
- Ensure responsive design

### Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation changes
  - `style:` - Formatting changes
  - `refactor:` - Code restructuring
  - `test:` - Adding tests
  - `chore:` - Maintenance tasks

Examples:
```
feat(sizer): Add GPU workload support
fix(validation): Correct CIDR range validation
docs: Update README with new features
```

## Project Structure

```
├── index.html          # Main wizard page
├── js/                 # JavaScript modules
│   ├── script.js       # Main application logic
│   ├── utils.js        # Utility functions
│   ├── validation.js   # Input validation
│   ├── dns.js          # DNS utilities
│   ├── formatting.js   # Number/text formatting
│   ├── theme.js        # Theme switching
│   ├── notifications.js # Toast notifications
│   └── analytics.js    # Usage analytics
├── css/
│   └── style.css       # Main stylesheet
├── sizer/              # ODIN Sizer tool
├── arm/                # ARM template generator
├── report/             # Report generator
├── docs/               # Documentation pages
├── images/             # Static images
└── tests/              # Unit tests
```

## Questions?

If you have questions about contributing, please open a [Discussion](https://github.com/Azure/odinforazurelocal/discussions) or reach out through the issue tracker.

Thank you for helping improve ODIN for Azure Local!

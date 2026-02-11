# Contributing to ODIN for Azure Local

Thank you for your interest in ODIN (Optimal Deployment and Infrastructure Navigator) for Azure Local!

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## How to Contribute

We welcome feedback and suggestions through GitHub Issues. To ensure maintainability and quality, **code contributions via pull requests are not accepted at this time** - the repository has forking disabled.

### Reporting Bugs

If you find a bug, please [open an issue](https://github.com/Azure/odinforazurelocal/issues/new) with:

- **Clear title** describing the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Browser and OS** information
- **Screenshots** if applicable

### Requesting Features

Have an idea for improvement? [Open a feature request](https://github.com/Azure/odinforazurelocal/issues/new) with:

- **Clear description** of the feature
- **Use case** - why would this be valuable?
- **Any examples** or mockups if available

### Before Opening an Issue

1. **Search existing issues** to avoid duplicates
2. **Check the documentation** - your question may already be answered
3. **Use a descriptive title** to help others find related issues

## Questions?

For general questions about using ODIN, please open a [Discussion](https://github.com/Azure/odinforazurelocal/discussions) rather than an issue.

## Project Information

### Technology Stack

- HTML5, CSS3, Vanilla JavaScript
- No external frameworks - runs entirely client-side
- localStorage API for state persistence

## Development

This section is for documentation purposes only, not for contributing code changes. If you encounter an issue, have feedback or would like a new feature, please see [How to Contribute](#how-to-contribute).
### File Structure

```
odinforazurelocal/
├── index.html              # Main wizard interface
├── README.md               # Documentation
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contribution guidelines
├── LICENSE                 # License file
├── SECURITY.md             # Security policy
├── package.json            # Project metadata and scripts
├── arm/
│   ├── arm.html            # ARM parameters viewer
│   └── arm.js              # ARM parameters generation
├── css/
│   └── style.css           # UI styling
├── docs/
│   ├── archive/            # Archived documentation
│   │   ├── EXPORT_FORMATS.md
│   │   ├── FRAMEWORK_MIGRATION.md
│   │   └── IMPLEMENTATION_SUMMARY.md
│   └── outbound-connectivity/
│       ├── index.html      # Outbound connectivity guide
│       ├── script.js       # Connectivity guide logic
│       ├── styles.css      # Connectivity guide styling
│       └── images/         # Connectivity diagrams (SVG)
├── images/
│   ├── odin-logo.png       # ODIN logo
│   └── odin-logo-white-background.png
├── js/
│   ├── script.js           # Core logic and state management
│   ├── analytics.js        # Firebase analytics integration
│   ├── dns.js              # DNS validation functions
│   ├── formatting.js       # Output formatting utilities
│   ├── nav.js              # Navigation functions
│   ├── notifications.js    # Toast notification system
│   ├── theme.js            # Theme toggle handling
│   ├── utils.js            # Shared utility functions
│   └── validation.js       # Input validation functions
├── report/
│   ├── report.html         # Configuration report template
│   └── report.js           # Report generation logic
├── sizer/
│   ├── index.html          # Hardware sizer tool
│   ├── sizer.css           # Sizer styling
│   └── sizer.js            # Sizer logic
├── tests/
│   ├── index.html          # Unit test suite
│   └── serve.ps1           # Local test server
└── scripts/
    └── run-tests.js        # CI test runner
```

### Technology Stack
- **HTML5** - Structure and semantic markup
- **CSS3** - Styling with custom properties and animations
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **localStorage API** - Client-side state persistence

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `saveStateToLocalStorage()` | `script.js` | Auto-saves wizard state |
| `exportConfiguration()` | `script.js` | Exports config as JSON |
| `importConfiguration()` | `script.js` | Imports config from JSON |
| `generateReport()` | `script.js` | Opens design document report in new tab |
| `generateArmParameters()` | `script.js` | Generates ARM template parameters JSON |
| `exportToPDF()` | `script.js` | Exports config as printable PDF |
| `getReportReadiness()` | `script.js` | Checks if all required fields are populated |
| `updateSummary()` | `script.js` | Renders live summary panel from wizard state |
| `updateUI()` | `script.js` | Master UI refresh — shows/hides steps based on state |
| `selectOption()` | `script.js` | Core wizard selection handler for option cards |
| `resetAll()` | `script.js` | Clears all state and resets the wizard |
| `showCidrCalculator()` | `script.js` | CIDR subnet calculator |
| `showHelp()` | `script.js` | Contextual help system |
| `showTemplates()` | `script.js` | Pre-built deployment templates |
| `renderDiagram()` | `script.js` | Renders Mermaid network topology diagram |
| `showOnboarding()` | `script.js` | Guided onboarding walkthrough |
| `validateFieldRealtime()` | `validation.js` | Real-time input validation |

### Adding Features

To extend the wizard:

1. **Add new step**: Update `index.html` with new section
2. **Add state property**: Update `state` object in `script.js`
3. **Update validation**: Add validation in `getReportReadiness()`
4. **Update summary**: Add summary rendering in `updateSummary()`
5. **Update exports**: Include in ARM/report generation

---

Thank you for helping improve ODIN for Azure Local!

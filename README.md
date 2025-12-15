# Azure Local Design Assistant (ALDA) Tool

## Version 0.2.0

A comprehensive web-based wizard to help design and configure Azure Local (formerly Azure Stack HCI) network architecture. This tool guides users through deployment scenarios, network topology decisions, security configuration, and generates ARM parameters for deployment.

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Prerequisites](#prerequisites)
- [Usage Guide](#usage-guide)
- [Configuration Options](#configuration-options)
- [Export Formats](#export-formats)
- [Development](#development)
- [Browser Compatibility](#browser-compatibility)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### ✨ Core Functionality
- **Step-by-Step Wizard**: Guided decision flow for Azure Local network configuration
- **Multiple Deployment Scenarios**: Hyperconverged, Disaggregated, Disconnected, and Multi-Rack
- **Cloud Witness Configuration**: Automatic witness type selection based on cluster topology
- **Storage Pool Management**: Configure storage pool deployment mode (Express, InfraOnly, KeepStorage)
- **Security Configuration**: Configure security controls with recommended or customized settings
- **Auto-Scroll Navigation**: Optional automatic scrolling to next step with 1-second delay (toggle on/off)
- **Intelligent Validation**: Real-time input validation with helpful error messages
- **Visual Feedback**: Architecture diagrams and network topology visualizations
- **ARM Parameters Generation**: Export Azure Resource Manager parameters JSON

### 🎉 Version 0.2.0 Enhancements
- **Auto-Scroll Toggle**: Control automatic navigation between wizard steps
- **Cloud Witness Type**: Automatic witness configuration based on cluster size and topology
- **Storage Pool Configuration**: Choose deployment mode at Step 15
- **Enhanced Port Configuration**: Direct scroll to port settings, default 25GbE speed
- **Updated Step Flow**: Reorganized steps for better logical progression

### 🎉 Version 0.1.0 Enhancements
- **Auto-Save & Resume**: Automatic progress saving using browser localStorage
- **Export/Import Configuration**: Share configurations as JSON files
- **Cost Estimator**: Rough monthly cost estimates based on configuration
- **CIDR Calculator**: Built-in subnet calculator for IP planning
- **Real-time Validation**: Instant feedback on all input fields
- **Contextual Help**: In-line help tooltips for complex concepts
- **Toast Notifications**: Clear feedback for user actions
- **Change Tracking**: Detect changes when importing configurations
- **Version Control**: All exports include version information
- **Enhanced Security**: Improved input sanitization throughout

---

## Getting Started

### Quick Start

1. **Open the wizard**:
   - Open `index.html` in a modern web browser
   - Or serve via a local web server: `pwsh serve.ps1` (runs on http://localhost:8080)

2. **Follow the wizard**:
   - Answer questions about your deployment scenario
   - Configure network settings, storage, and identity options
   - Review the configuration summary in real-time

3. **Export your configuration**:
   - Generate ARM parameters JSON
   - Export full configuration for sharing or backup
   - Download configuration reports

### Prerequisites Checklist

Before starting, ensure you have:

#### Hardware
- ✅ Azure Local certified hardware (check [Microsoft Hardware Catalog](https://aka.ms/AzureStackHCICatalog))
- ✅ Minimum 2 nodes (up to 16 for single-site clusters)
- ✅ RDMA-capable network adapters for storage
- ✅ Compatible ToR switches with proper firmware

#### Network
- ✅ Outbound internet connectivity or configured proxy
- ✅ Available IP address ranges for infrastructure and management
- ✅ DNS servers configured and reachable
- ✅ VLAN support (if using tagged VLANs)
- ✅ Network Time Protocol (NTP) configured

#### Azure
- ✅ Active Azure subscription with appropriate permissions
- ✅ Azure Arc resource provider registered
- ✅ Sufficient quota for Azure Local resources
- ✅ Resource group created in target region

#### Identity & Access
- ✅ Active Directory domain or Local Identity setup
- ✅ Domain credentials with appropriate permissions
- ✅ Service Principal or Managed Identity for Azure integration

---

## Usage Guide

### Navigation

The wizard follows a sequential flow:
1. **Deployment Scenario** - Select your architecture type
2. **Azure Cloud** - Choose Azure environment (Public, Government, China)
3. **Azure Local Instance Region** - Select deployment region
4. **Scale** - Choose single-site or rack-aware
5. **Nodes** - Specify number of cluster nodes
6. **Network Configuration** - Configure ports, storage, and traffic intents
7. **Connectivity** - Set up outbound connectivity and Arc Gateway
8. **IP Assignment** - Configure static or DHCP
9. **Infrastructure Network** - Define management network and IP pools
10. **Identity** - Configure Active Directory or Local Identity
11. **SDN Options** (Optional) - Enable software-defined networking features

### Key Actions

#### Auto-Save & Resume
- Progress is automatically saved to browser localStorage
- Return anytime and see a "Resume Session" prompt
- Choose to continue or start fresh

#### Export Configuration
- Click **Export Config** button in header
- Saves complete state as timestamped JSON file
- Share with team members or backup for later

#### Import Configuration
- Click **Import Config** button in header
- Select previously exported JSON file
- Review changes and confirm import

#### CIDR Calculator
- Click **CIDR Calculator** in header
- Enter IP/CIDR notation (e.g., 192.168.1.0/24)
- See network details, usable host range, and subnet info

#### Cost Estimator
- Click **Cost Estimate** in header
- View rough monthly cost breakdown
- Based on node count, Arc Gateway, and region

---

## Configuration Options

### Deployment Scenarios

| Scenario | Description | Use Case |
|----------|-------------|----------|
| **Hyperconverged** | Compute and storage on same nodes | Most common, balanced workloads |
| **Disaggregated** | Separate compute and storage nodes | High-performance scenarios |
| **Disconnected** | No internet connectivity | Air-gapped environments |
| **Multi-Rack** | Multiple availability zones | High availability, large scale |

### Network Intents

| Intent | Description | Adapters |
|--------|-------------|----------|
| **Compute + Management** | Shared network for VMs and management | 2 adapters (redundant) |
| **Compute + Storage** | Combined compute and storage traffic | 4+ adapters |
| **All Traffic** | Single intent for all network types | 2 adapters |
| **Custom** | User-defined adapter mapping | Flexible |

### Storage Connectivity

| Type | Description | Requirements |
|------|-------------|--------------|
| **Switched** | Traditional ToR switch-based | ToR switches, suitable for any scale |
| **Switchless** | Direct node-to-node connections | 2-4 nodes, no storage switches |

---

## Export Formats

### ARM Parameters JSON
- Azure Resource Manager template parameters
- Ready for deployment with Azure CLI or Portal
- Includes placeholders for values not collected by wizard
- **Copy to Clipboard**: Available on ARM parameters page

### Configuration JSON
- Complete wizard state export
- Version-tagged for compatibility tracking
- Includes timestamp and metadata
- Can be re-imported to restore session

### Reports
- Comprehensive HTML reports
- Download as HTML or Word (DOCX-compatible)
- Includes decision rationale and network diagrams
- Print-friendly formatting

---

## Development

### File Structure

```
Dyktio-v3/
├── index.html          # Main wizard interface
├── script.js           # Core logic and state management
├── style.css           # UI styling
├── report.html         # Configuration report template
├── report.js           # Report generation logic
├── arm.html            # ARM parameters viewer
├── arm.js              # ARM parameters generation
├── serve.ps1           # Local development server
└── README.md           # This file
```

### Technology Stack
- **HTML5** - Structure and semantic markup
- **CSS3** - Styling with custom properties and animations
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **localStorage API** - Client-side state persistence

### Key Functions

| Function | Purpose |
|----------|---------|
| `saveStateToLocalStorage()` | Auto-saves wizard state |
| `exportConfiguration()` | Exports config as JSON |
| `importConfiguration()` | Imports config from JSON |
| `validateFieldRealtime()` | Real-time input validation |
| `showCidrCalculator()` | CIDR subnet calculator |
| `estimateCosts()` | Cost estimation tool |
| `showHelp()` | Contextual help system |

### Adding Features

To extend the wizard:

1. **Add new step**: Update `index.html` with new section
2. **Add state property**: Update `state` object in `script.js`
3. **Update validation**: Add validation in `getReportReadiness()`
4. **Update summary**: Add summary rendering in `updateSummary()`
5. **Update exports**: Include in ARM/report generation

---

## Browser Compatibility

### Supported Browsers
- ✅ **Chrome/Edge** 90+ (Recommended)
- ✅ **Firefox** 88+
- ✅ **Safari** 14+
- ✅ **Opera** 76+

### Required Features
- ES6+ JavaScript support
- CSS Custom Properties
- Flexbox and Grid
- localStorage API
- File API (for import/export)

### Known Limitations
- Internet Explorer is **not supported**
- Mobile browsers may have layout limitations
- Safari private mode disables localStorage

---

## Troubleshooting

### Common Issues

#### "Previous Session Found" doesn't appear
- localStorage may be disabled in browser settings
- Private/Incognito mode disables localStorage
- Clear browser cache and try again

#### Export/Import not working
- Check browser console for errors
- Ensure pop-up blocker isn't preventing downloads
- Verify file is valid JSON (use JSON validator)

#### Validation errors on import
- Imported file may be from incompatible version
- Check `version` field in JSON matches current version
- Try exporting fresh config to verify format

#### Cost estimates seem wrong
- Cost estimator provides rough estimates only
- Actual costs vary by region, usage, and other factors
- Use official [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for accurate quotes

### Debugging

Enable detailed logging in browser console:
1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for errors or warnings
4. Check localStorage: `localStorage.getItem('azureLocalWizardState')`

---

## Version History

### v0.1.0 (Current)
- ✨ Auto-save and resume capability
- ✨ Export/import configuration
- ✨ Cost estimator
- ✨ CIDR calculator
- ✨ Real-time validation
- ✨ Contextual help system
- ✨ Toast notifications
- 🔒 Enhanced input sanitization
- 📊 Version tracking
- 🔄 Change detection

### v0.0.1 (Previous)
- Initial release of wizard framework
- Support for multiple deployment scenarios
- ARM parameters generation
- Report generation

---

## Best Practices

### Using the Wizard
1. **Review Prerequisites** - Click "Prerequisites" before starting
2. **Save Progress** - Export configuration at major milestones
3. **Validate Early** - Use real-time validation to catch errors
4. **Use Calculator** - CIDR calculator helps avoid subnet conflicts
5. **Check Estimates** - Cost estimator for budget planning

### Network Planning
1. **Document IP Ranges** - Keep track of all CIDRs and ranges
2. **Avoid Overlaps** - Use CIDR calculator to verify no conflicts
3. **Plan for Growth** - Size infrastructure pool with headroom
4. **Test DNS** - Verify DNS resolution before deployment
5. **Review Gateway** - Ensure default gateway is outside IP pools

### Configuration Management
1. **Export Regularly** - Save configuration at each major decision
2. **Version Control** - Keep exports with version tags
3. **Share with Team** - Use export/import to collaborate
4. **Document Changes** - Note modifications in separate doc
5. **Backup Configs** - Store exports in version control system

---

## Security Considerations

### Input Sanitization
- All user inputs are sanitized using `escapeHtml()` and context-specific sanitizers
- CIDR and IP validation prevents injection attempts
- File imports are validated for correct structure

### Data Storage
- All data stored in browser localStorage (client-side only)
- No data transmitted to external servers
- Clear localStorage on shared computers

### Best Practices
- Don't include sensitive credentials in configurations
- Don't share exports containing private IP ranges publicly
- Review imported configs before applying
- Use prerequisites checklist to verify security requirements

---

## Contributing

### Reporting Issues
- Report bugs or request features via GitHub Issues
- Include browser version, OS, and steps to reproduce
- Provide exported config (sanitized) if helpful

### Code Contributions
- Follow existing code style and structure
- Test changes in multiple browsers
- Update documentation for new features
- Add validation for new input fields

---

## Additional Resources

### Official Documentation
- [Azure Local Documentation](https://learn.microsoft.com/azure-stack/hci/)
- [Network Reference Patterns](https://learn.microsoft.com/azure-stack/hci/plan/network-patterns-overview)
- [Azure Arc Documentation](https://learn.microsoft.com/azure/azure-arc/)

### Community
- [Azure Local Tech Community](https://techcommunity.microsoft.com/t5/azure-stack-hub/ct-p/AzureStackHub)
- [GitHub - Azure Local Supportability](https://github.com/Azure/AzureLocal-Supportability)

---

## License

This project is provided as-is for planning and configuration purposes. See official Azure documentation for deployment guidance and support.

---

## Acknowledgments

Built for the Azure Local community to simplify network architecture planning and deployment configuration.

**Version**: 0.1.0  
**Last Updated**: December 2025  
**Compatibility**: Azure Local 2506+

---

For questions, feedback, or support, please visit the [GitHub repository](https://github.com/Azure/AzureLocal-Supportability) or consult the official Azure Local documentation.

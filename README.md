# Odin for Azure Local

## Version 0.14.54 - Available here: https://aka.ms/ODIN-for-AzureLocal

A comprehensive web-based wizard to help design and configure Azure Local (formerly Azure Stack HCI) network architecture. This tool guides users through deployment scenarios, network topology decisions, security configuration, and generates ARM parameters for deployment with automated deployment scripts.

> **Disclaimer:** This tool is provided as-is without Microsoft support. This is an experimental project to help customers accelerate their skills ramp up for Azure Local, while helping IT architects to validate desired configurations.

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Prerequisites](#prerequisites)
- [Usage Guide](#usage-guide)
- [Configuration Options](#configuration-options)
- [Export Formats](#export-formats)
- [Browser Compatibility](#browser-compatibility)
- [Troubleshooting](#troubleshooting)
- [Contributing](CONTRIBUTING.md)
- [License](#license)
- [Appendix A - Version History](#appendix-a---version-history)

---

## Features

### ✨ Core Functionality
- **Step-by-Step Wizard**: Guided decision flow for Azure Local network configuration
- **Multiple Deployment Scenarios**: Hyperconverged, Multi-Rack, Disconnected, and M365 Local
- **Cloud Witness Configuration**: Automatic witness type selection based on cluster topology
- **Storage Pool Management**: Configure storage pool deployment mode (Express, InfraOnly, KeepStorage)
- **Security Configuration**: Configure security controls with recommended or customized settings
- **Auto-Scroll Navigation**: Optional automatic scrolling to next step with 1-second delay (toggle on/off)
- **Intelligent Validation**: Real-time input validation with helpful error messages
- **Visual Feedback**: Architecture diagrams and network topology visualizations
- **ARM Parameters Generation**: Export Azure Resource Manager parameters JSON

### 🎉 Version 0.14.54 - Latest Release
- **NIC Mapping to Intent ([#88](https://github.com/Azure/odinforazurelocal/issues/88))**: Fixed adapter-to-intent assignment ignoring RDMA on Low Capacity scale — non-RDMA ports now correctly preferred for Management + Compute across all scales
- **Safari Drag-and-Drop ([#88](https://github.com/Azure/odinforazurelocal/issues/88))**: Fixed adapter mapping "flip-flop" on Safari where click fired after drag, reversing the user's intended assignment
- **Mobile-Responsive Navigation ([#87](https://github.com/Azure/odinforazurelocal/issues/87))**: Nav bar now collapses to icon-only on mobile portrait; onboarding "Next" button always reachable
- **Mermaid Diagram Export ([#86](https://github.com/Azure/odinforazurelocal/issues/86))**: Copy or download network diagrams as Mermaid markup with intent grouping and switchless subnet connections
- **Touch Device Support**: Added tap-to-select fallback for adapter mapping on mobile Safari and touch devices
- **215 Unit Tests**: Expanded from 198 to 215 tests with regression coverage for NIC mapping fixes

> **Full Version History**: See [Appendix A - Version History](#appendix-a---version-history) for complete release notes.

---

## Getting Started

### Quick Start

1. **Open the ODIN designer wizard**:
   - Open in a modern web browser, navigate to ODIN online version: https://aka.ms/ODIN-for-AzureLocal
   - For offline or local access, download the source code of this repo, to run a local web server: `PowerShell.exe -ExecutionPolicy Bypass -file .\tests\serve.ps1` (then open address http://localhost:5500 using browser)

2. **Follow the wizard**:
   - Answer questions about your deployment scenario
   - Configure network settings, storage, and identity options
   - Review the configuration summary in real-time

3. **Export your configuration**:
   - Generate ARM parameters JSON
   - Export full configuration for sharing or backup
   - Download configuration reports

### Prerequisites Checklist

If you want to deploy Azure Local on physical hardware, before starting, ensure you have:

#### Hardware
- ✅ Azure Local certified hardware (check [Microsoft Hardware Catalog](https://aka.ms/AzureStackHCICatalog))
- ✅ Minimum 1 node (up to 16 for single-site clusters)
- ✅ RDMA-capable network adapters for storage, for multi-node clusters.
- ✅ Compatible Top of Rack (ToR) switches with latest firmware installed.

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
- ✅ Managed Identity is required / created for Azure integration

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
- Click **Export** button in the summary panel (right side)
- Saves complete state as timestamped JSON file
- Share with team members or backup for later

#### Import Configuration
- Click **Import** button in the summary panel (right side)
- Select previously exported JSON file
- Review changes and confirm import

#### CIDR Calculator
- Click **Subnet Calculator** button next to the Infrastructure Network CIDR input
- Enter IP/CIDR notation (e.g., 192.168.1.0/24)
- See network details, usable host range, and subnet info

#### Templates
- Click **Load Example Configuration Template** in the summary panel (right side)
- Browse pre-built deployment configurations for common scenarios
- Load a template to pre-populate the wizard with recommended settings

#### Onboarding Walkthrough
- Automatically shown on first visit (can be reset by clearing browser localStorage)
- Step-by-step overlay highlighting key wizard features
- Helps new users understand the workflow quickly

---

## Configuration Options

### Deployment Scenarios

| Scenario | Description | Use Case |
|----------|-------------|----------|
| **Hyperconverged** | Single rack or rack-aware cluster with compute, storage, and network | Most common, balanced workloads. One to sixteen nodes in scale. |
| **Multi-Rack** | Scalable, multi-rack distributed architecture | High availability, large scale |
| **Disconnected** | Air-gapped operation with local management | Isolated / security-sensitive environments |
| **M365 Local** | Microsoft 365 workloads with minimum 9 nodes | M365 on-premises deployments |

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
- Comprehensive configuration reports
- Download as Word (DOCX-compatible), Markdown, or PDF
- Includes decision rationale and network diagrams
- Print-friendly formatting

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

### Debugging

Enable detailed logging in browser console:
1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for errors or warnings
4. Check localStorage: `localStorage.getItem('azureLocalWizardState')`

### Report an Issue and Contributing:
- Report bugs or request new features using GitHub [Issues](https://github.com/Azure/odinforazurelocal/issues)
- Include browser version, OS, screenshot if possible, and steps to reproduce the issue.
- Provide exported config (sanitized) if required to recreate the problem.

For detailed contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Best Practices

### Using the Wizard
1. **Review Prerequisites** - Click "Prerequisites" before starting
2. **Try Templates** - Load a pre-built template for common scenarios
3. **Save Progress** - Export configuration at major milestones
4. **Validate Early** - Use real-time validation to catch errors
5. **Use Calculator** - CIDR calculator helps avoid subnet conflicts

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

## Additional Resources

### Official Documentation
- [Azure Local Documentation](https://learn.microsoft.com/azure-stack/hci/)
- [Network Reference Patterns](https://learn.microsoft.com/azure-stack/hci/plan/network-patterns-overview)
- [Azure Arc Documentation](https://learn.microsoft.com/azure/azure-arc/)

### Community
- [Azure Local Tech Community](https://techcommunity.microsoft.com/t5/azure-stack-hub/ct-p/AzureStackHub)
- [GitHub - Azure Local Supportability Forum](https://github.com/Azure/AzureLocal-Supportability)

---

## License

Published under [MIT License](/LICENSE). This project is provided as-is, without warranty or support, it is intended for planning and automation example purposes. See official Azure documentation for deployment guidance and support.

---

## Acknowledgments

Built for the Azure Local community to simplify network architecture planning and deployment configuration.

**Version**: 0.14.54  
**Last Updated**: February 10th 2026  
**Compatibility**: Azure Local 2506+

---

For questions, feedback, or support, please visit the [GitHub repository](https://github.com/Azure/odinforazurelocal) or consult the official Azure Local documentation.

---

## Appendix A - Version History

For detailed changelog information, see [CHANGELOG.md](CHANGELOG.md).

### 🎉 Version 0.14.x Series (February 2026)

#### 0.14.54 - NIC Mapping Fix, Mobile Nav & Mermaid Export
- **NIC Mapping to Intent (#88)**: Fixed adapter assignment ignoring RDMA on Low Capacity scale
- **Safari Drag-and-Drop (#88)**: Fixed adapter mapping flip-flop caused by click firing after drag
- **Mobile-Responsive Navigation (#87)**: Nav bar collapses to icon-only on mobile portrait; onboarding card scrollable
- **Mermaid Diagram Export (#86)**: Copy or download network diagrams as Mermaid markup with intent grouping and switchless subnet connections
- **Touch Device Support**: Tap-to-select fallback for adapter mapping on mobile/touch devices
- **215 Unit Tests**: Expanded test suite with NIC mapping regression coverage

#### 0.14.53 - Bug Fixes, Port Name Consistency & CI Hardening
- **ARM Storage Adapter Naming (#74)**: Fixed ARM template adapter naming for StorageNetwork1/2
- **Switchless Intent Adapter Names**: Fixed `intentList` using `SMB N` instead of `Port N` for switchless storage
- **VLAN Defaults (#75)**: Fixed empty string VLAN values producing invalid VLAN ID 0
- **NIC Speed (#76)**: Removed forced 10 GbE speed override on single-node clusters
- **IP Validation (#78)**: Node IPs and DNS reject network/broadcast addresses
- **Default Gateway Validation**: Fixed gateway validation warning on resume/load
- **Storage VLAN Placeholders**: Fixed `REPLACE_WITH_STORAGE_VLAN` in ARM output for custom intent with adapter mapping
- **Port Name Consistency**: ARM adapter names match wizard display names
- **Shared Navigation Bar**: Centralized nav component across all pages with Feedback link
- **198 Unit Tests**: Expanded test suite with regression coverage

#### 0.14.52 - Markdown Export, Diagram Fix & Validation
- **Markdown Report Export**: Download the Configuration Report as a Markdown file with embedded network diagrams for documentation or version control
- **Custom Intent Diagram Grouping**: Fixed network diagram to properly group adapters by intent when using custom intent configurations with non-contiguous port assignments
- **Duplicate Adapter Name Validation**: Prevents duplicate adapter names in port configuration with visual feedback

#### 0.14.51 - Automated Build Pipeline & Bug Fixes
- **GitHub Actions CI/CD**: Automated build validation pipeline with ESLint, HTML validation, and 136 unit tests
- **Light Mode Input Fix**: Fixed node name, IP, and DNS input fields showing white text on light theme backgrounds

#### 0.14.50 - Codebase Modularization
- **Project Restructured**: Cleaner folder organization (arm/, report/, css/, js/, tests/, scripts/)
- **Phase 2A Modularization**: Extracted formatting, validation, and DNS functions into dedicated modules
- **136 Unit Tests**: Comprehensive test coverage expanded from 34 to 136 tests

#### 0.14.2 - ARM Template Import Fixes
- **Adapter Names Preserved**: Importing ARM templates preserves adapter names from the template
- **Single-Node Diagram**: Fixed diagram not displaying for single-node deployments

#### 0.14.1 - ARM Import Adapter Fix
- **Management + Compute Adapters**: Fixed adapters not loading when importing ARM templates

#### 0.14.0 - Code Modularization Phase 1
- **Modular JavaScript**: Extracted utilities into separate files (utils.js, theme.js, notifications.js, analytics.js)
- **Diagram NIC Labels**: Improved label positioning for all cluster diagram types

### 🎉 Version 0.13.x Series (February 2026)

#### 0.13.30 - ARM Import & Theme Improvements
- **Private Endpoints Import**: ARM import dialog now asks about Private Endpoints configuration
- **Theme Fixes**: Fixed disclaimer banner, nav bar, sizer dropdowns, progress bar, breadcrumbs, and summary panel theme support

#### 0.13.19 - Navigation Enhancements
- **Sizer Preview Badge**: Added "Preview" badge on Sizer tab
- **Theme Toggle**: Added theme toggle button to navigation bar on all pages

### 🎉 Version 0.11.x Series
- **Tab Navigation System**: New top navigation bar with Designer, Knowledge, and Sizer sections
- **Session Persistence**: Active tab state persists during browser session

### 🎉 Version 0.10.x Series

#### 0.10.12 - Outbound Connectivity Guide
- **Private Path Documentation**: Architecture diagrams for Public Path vs Private Path (ExpressRoute)
- **Private Endpoints Selection**: Wizard step for selecting Azure services with Private Link

#### 0.10.11 - 0.10.6 - Configuration Report Improvements
- **Storage IP Display**: Various fixes for storage adapter IPs, switchless configurations, and subnet display

#### 0.10.5 - Security Details Fix
- **Configuration Report**: Fixed security settings display in reports

#### 0.10.4 - Single-Node Support
- **Storage Intent**: Single-node clusters now support all storage intent options

#### 0.10.0-0.10.1 - ARM Import Improvements
- **OU Path Auto-Population**: Pre-filled from wizard values
- **Import Options Dialog**: Prompts for Arc Gateway, Proxy, and SDN settings

### 🎉 Version 0.9.x Series

#### 0.9.7 - Deploy to Azure UX
- **Step-by-Step Instructions**: Improved guidance for Azure Portal deployment

#### 0.9.5-0.9.6 - Enhancements & Fixes
- **Alphabetized Regions**: Commercial regions in alphabetical order
- **Knowledge Links**: Added documentation links throughout wizard

#### 0.9.3-0.9.4 - Bug Fixes
- **Custom Adapter Mapping**: Fixed ARM output and diagrams
- **DNS Server Display**: Fixed after ARM import or session resume

#### 0.9.0 - ARM Template Import
- **Import/Export**: Import ARM templates directly from Azure Portal exports
- **Complete Templates**: All 5 example templates include full configurations

### 🎉 Version 0.8.x Series
- **Firebase Analytics**: Optional usage tracking
- **Deploy to Azure Button**: One-click deployment to Azure Portal
- **ToR Switch Selection**: Single or Dual ToR options

### 🎉 Version 0.2.x Series
- **AD OU Path**: Organization Unit path configuration
- **Auto-Scroll Toggle**: Control automatic navigation
- **Cloud Witness**: Automatic configuration based on cluster topology

### 🎉 Version 0.1.0 - Initial Release
- **Auto-Save & Resume**: Browser localStorage persistence
- **Export/Import**: Share configurations as JSON files
- **Cost Estimator**: Rough monthly cost estimates
- **CIDR Calculator**: Built-in subnet calculator
- **Real-time Validation**: Instant input feedback

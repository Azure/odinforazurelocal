# Odin for Azure Local

## Version 0.15.98 - Available here: https://aka.ms/ODIN-for-AzureLocal

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
- [Report an Issue and Contributing](#report-an-issue-and-contributing)
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

### 🎉 Version 0.15.98 - Latest Release
- **Default Gateway Field Fix for Safari (#98)**: Fixed the Default Gateway input in Step 15 (Infrastructure Network) becoming unclickable on Safari. The field is now properly disabled/enabled alongside its sibling inputs, ensuring consistent compositing behaviour across all browsers.

### Version 0.15.97
- **Dynamic Storage Networks for Switched Storage (#113)**: Switched storage configurations with more than 2 RDMA NICs now dynamically generate the correct number of storage networks, VLANs, and ARM storageNetworkList entries (up to 8 per Network ATC). Previously hardcoded to 2 networks regardless of NIC count.

### Version 0.15.96
- **DIMM-Symmetric Memory Configuration (#119)**: Memory per Node is a dropdown with server-realistic DIMM-symmetric values (64, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096 GB) matching symmetric DIMM populations across 24 DIMM slots
- **Expanded Disk Count Options (#119)**: Capacity Disks per Node and Cache Disks per Node dropdowns now include every value from 2–24 (capacity, all-flash) / 2–16 (capacity, hybrid) and 2–8 (cache), allowing any disk quantity
- **Disk Size Auto-Scaling**: When disk count reaches 24 and storage is still insufficient, auto-scale steps up disk size through standard capacities (0.96, 1.92, 3.84, 7.68, 15.36 TB) with 80% headroom
- **CPU Sockets Capped at 2**: Removed 4-socket option — Azure Local OEM certified hardware supports 1 or 2 sockets at this time
- **Configurable vCPU Overcommit Ratio**: New Advanced Settings section with selectable vCPU-to-pCPU ratio (1:1, 2:1, 4:1, 5:1, 6:1) — replaces the hardcoded 4:1 assumption, allowing users to match their hypervisor density policy
- **GPU Model Granularity**: GPU type dropdown now lists individual NVIDIA models (A2, A16, L4, L40, L40S) with VRAM and TDP per model, shown in results and export — select 0, 1, or 2 GPUs per node
- **Intel Xeon D 27xx (Edge)**: Added Intel Xeon D-2700 (Ice Lake-D) CPU generation for edge/rugged deployments (4–20 cores, DDR4-3200)
- **Minimum 2 Capacity & Cache Disks**: Disk count minimums raised from 1 to 2, matching Azure Local system requirements
- **Hybrid Disk Chassis Limit**: Cache disks capped at 8, hybrid capacity disks at 16 (total 24 drive bays per 2U chassis, 1:2 cache-to-capacity ratio)
- **Mixed All-Flash Disk Chassis Limit**: Same 24 drive bay constraint for mixed all-flash (NVMe cache + SSD capacity). Sizing note recommends single-type all-flash for increased capacity
- **Single-Node All-Flash Only**: Single-node clusters now block hybrid storage — only all-flash is supported
- **Cache Metadata Overhead Note**: Sizing notes show 4 GB RAM per TB of cache capacity for storage metadata
- **400 TB Per-Machine Warning**: Sizing note warns when raw storage exceeds 400 TB per machine
- **4 PB Cluster Cap Warning**: Sizing note warns when total cluster raw storage exceeds 4 PB (4,000 TB)
- **Network Bandwidth Note**: Sizing note recommends RDMA-capable NICs with 25 GbE+ for storage traffic
- **Boot/OS Drive Note**: Sizing note calls out minimum 200 GB boot drive (400 GB+ for systems with >768 GB RAM)
- **Cluster Size Capacity Bar**: New "Azure Local hyperconverged instance size" visual bar in Capacity Breakdown showing physical node count out of 16 maximum, with N+1 servicing and redundancy note
- **Rack-Aware Cluster Size Bar**: Cluster size bar dynamically adjusts maximum from 16 to 8 nodes when Rack-Aware cluster type is selected
- **vCPU Ratio Auto-Escalation**: When compute ≥90% and CPU cores/sockets are maxed, the overcommit ratio auto-escalates from 4:1 → 5:1 → 6:1 with a red warning in sizing notes
- **Sizer-to-Report Data Flow**: vCPU ratio, GPU model, future growth, and cluster type now carry through from Sizer → Designer → Configuration Report
- **Updated Auto-Scale Logic**: Hardware auto-scaling steps through DIMM-symmetric memory options and disk counts instead of arbitrary increments

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

**Version**: 0.15.98  
**Last Updated**: June 2026  
**Compatibility**: Azure Local 2506+

---

For questions, feedback, or support, please visit the [GitHub repository](https://github.com/Azure/odinforazurelocal) or consult the official Azure Local documentation.

---

## Appendix A - Version History

For detailed changelog information, see [CHANGELOG.md](CHANGELOG.md).

### 🎉 Version 0.15.x Series (February 2026)

#### 0.15.01 - ODIN Sizer (Preview) & Designer Integration
- **ODIN Sizer (Preview)**: New hardware sizing tool to calculate cluster requirements based on workload scenarios (VMs, AKS, AVD), resiliency, and capacity needs
- **Sizer-to-Designer Integration**: "Configure in Designer" button transfers hardware config into the Designer wizard, auto-populating Hyperconverged, Azure Commercial, East US, cluster type, and node count
- **"Unsure? Start with Sizer" Links**: Steps 04 and 05 in the Designer now include navigation links to the Sizer
- **Hardware in Configuration Report**: Conditional Hardware Configuration section in reports when imported from Sizer
- **Sizer Session Persistence**: Auto-save/resume with localStorage, matching the Designer pattern
- **Auto-Sizing Engine**: Intelligent node and disk scaling based on workload compute, memory, and storage requirements — favours scaling up CPU cores, memory (up to 1 TB), and disks per node before adding nodes
- **Capacity Utilization Guard**: Blocks configurations when Compute, Memory, or Storage utilization ≥ 90% with visual warning and disabled Designer button
- **Hybrid Cache-to-Capacity Ratio**: Hybrid storage enforces 1:2 cache-to-capacity disk ratio (e.g., 6 cache + 12 HDD)
- **Hardware Configuration Panel**: CPU manufacturer/generation/cores/sockets, memory, and tiered storage configuration
- **Export Options**: Save as PDF and Word export for sizer results
- **Edit Workloads**: Edit existing workloads via cog icon on workload cards
- **Official Azure Icons**: VM, AKS Arc, and AVD workload types use official Azure service icons
- **ODIN Favicon**: Browser favicon (ODIN logo) across all pages
- **Clean Navigation URLs**: Internal links use folder paths instead of explicit index.html
- **AVD Session Type**: Multi-session (shared VMs) / single-session (dedicated VM per user) dropdown with session-type-aware specs aligned to Microsoft session host sizing guidelines
- **AVD Heavy Profile**: New workload tier for engineers and content creators (per MS session host sizing guide)
- **AVD Max Concurrency %**: Default 90% — reduces compute/memory sizing for realistic peak loads; auto-hidden for single-session (always 100%)
- **AVD FSLogix Profile Storage**: Optional checkbox + per-user GB (default 30 GB) for user profile container storage
- **AVD Knowledge Links**: Links to AVD for Azure Local architecture guide and session host sizing guidelines
- **AVD Simulation Tools Note**: Recommendation to use LoginVSI for stress testing
- **AVD Max Density Indicator**: Shows users/vCPU for multi-session or "Dedicated VM per user" for single-session
- **2-Way Mirror Warning**: Recommendation banner when 2-way mirror is selected on a standard 3+ node cluster
- **80% Headroom Auto-Scale**: Automatically bumps CPU cores/sockets and memory when capacity bars exceed 80%
- **Resiliency Note Wording**: Clearer descriptions for 2-way mirror (fault domain detail), 3-way mirror (fault domain detail), and 4-way mirror (rack-level nested mirror)
- **vCPU Ratio Note**: Updated to "vCPU calculations assume 4:1 pCPU to vCPU ratio"
- **High-Memory Note**: Updated to "Large memory system: Requires 400 GB+ or larger OS disks for supportability"
- **N+1 Storage Tip**: Removed misleading storage maintenance sentence
- **310 Unit Tests**: Expanded test suite with 6 new AVD profile assertions

### 🎉 Version 0.14.x Series (February 2026)

#### 0.14.61 - 2-Node Switchless Diagram Port Labels Fix
- **Report Diagram Port Labels (#93)**: Added missing `ports` variable in `renderSwitchlessStorageDiagram()` so adapter mapping resolution loop can iterate; diagram now shows correct port assignments

#### 0.14.60 - 2-Node Switchless VLAN & Diagram Fix
- **2-Node Switchless Storage VLANs (#93)**: `getStorageVlanOverrideNetworkCount()` now returns 2 for 2-node switchless, exposing both VLAN ID fields (711, 712) in overrides UI, ARM template, and summary
- **Report Diagram Port Labels (#93)**: 2-node switchless diagram now reads actual port assignments from `state.adapterMapping` instead of hardcoding Port 1,2 → Mgmt+Compute and Port 3,4 → Storage

#### 0.14.59 - Summary Blade NIC Mapping Fix
- **Summary Blade NIC Mapping (#88)**: Summary blade now reflects custom adapter mapping after confirmation

#### 0.14.58 - Character Encoding Fix
- **Character Encoding (#103)**: Fixed 106 corrupted UTF-8 characters in Configuration Report diagrams and legends

#### 0.14.57 - Storage Subnet CIDR Fix
- **Storage Subnet CIDRs (#99)**: SVG diagram legends now show correct Network ATC default subnets (10.71.x.0/24) when Auto IP is enabled

#### 0.14.56 - draw.io Orthogonal Routing & Report-Only Export
- **draw.io Orthogonal Routing (#94)**: Switchless storage connectors use L-shaped routing with dedicated lanes per subnet
- **Canonical Switchless Ports**: Forces correct port allocation for switchless mesh connectivity
- **Report-Only Export**: draw.io download button removed from wizard, available only on Configuration Report

#### 0.14.55 - Mermaid Export Fix for mermaid.live
- **Mermaid Export for mermaid.live (#94)**: Fixed exported Mermaid code failing on mermaid.live because it was wrapped in markdown code fences. Added separate "Copy for Mermaid.live" (raw) and "Copy for Markdown" (fenced) buttons in both the main tool and the Configuration Report.

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

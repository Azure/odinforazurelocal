# ODIN for Azure Local

## Version 0.20.67 - Available here: https://aka.ms/ODIN-for-AzureLocal

A comprehensive web-based wizard to help design and configure Azure Local (formerly Azure Stack HCI) architectures. This tool guides users through deployment scenarios, network topology decisions, security configuration, and generates a cluster design document and an ARM parameter file that can be used for automated deployments. The Sizer Tool can be used to provide example cluster hardware configurations, based on your workload scenarios and capacity requirements, and it includes a 3D visualization of the hardware.

> **Disclaimer:** This tool is provided as-is without Microsoft support. This is an experimental project to help customers accelerate their skills ramp up for Azure Local, while helping IT architects to validate desired configurations.

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Prerequisites Checklist](#prerequisites-checklist)
- [Usage Guide](#usage-guide)
- [Configuration Options](#configuration-options)
- [Export Formats](#export-formats)
- [Browser Compatibility](#browser-compatibility)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Security Considerations](#security-considerations)
- [Additional Resources](#additional-resources)
- [Report an Issue and Contributing](#report-an-issue-and-contributing)
- [License](#license)
- [Appendix A - Version History](#appendix-a---version-history)

---

## Features

### ✨ Core Functionality
- **Step-by-Step Designer Wizard**: Guided decision flow for Azure Local instance configuration, including network configuration, outbound endpoints, security and storage deployment options
- **Multiple Deployment Scenarios**: Hyperconverged, Multi-Rack, Disconnected, and Microsoft 365 Local
- **Disaggregated Architecture Wizard**: End-to-end wizard for disaggregated deployments with external SAN storage (Fibre Channel, iSCSI) and Clos leaf-spine fabric — VLAN/VNI/VRF configuration, QoS policy, IP planning, drag-and-drop NIC mapping, and interactive SVG rack topology diagrams
- **Hardware Sizer**: Workload-based hardware sizing for VMs, AKS, and AVD — calculates CPU, memory, storage, GPU, and node requirements with auto-scaling and power/rack-space estimates, and a 3D visualization of hardware in one to four 42U racks
- **ToR Switch Configuration Generator & QoS Validator**: Generate example Top of Rack switch configurations for Cisco NX-OS and Dell OS10 platforms — ToR, BMC, and border switch configs with rack-aware support, infrastructure token replacement, and JSON export. Validate existing switch configs against Azure Local QoS requirements (PFC, ETS, ECN)
- **Sizer-to-Designer Integration**: Size your hardware first, then transfer the configuration directly into the Designer wizard with one click
- **Designer-to-Sizer Integration**: Design your cluster first, then transfer deployment type and node count to the Sizer to add workloads
- **Cloud Witness Configuration**: Automatic witness type selection based on cluster topology
- **Storage Pool Management**: Configure storage pool deployment mode (Express, InfraOnly, KeepStorage)
- **Security Configuration**: Configure security controls with recommended or customized settings
- **Auto-Scroll Navigation**: Optional automatic scrolling to next step with 1-second delay (toggle on/off)
- **Intelligent Validation**: Real-time input validation with helpful error messages
- **Visual Feedback**: Architecture diagrams and network topology visualizations
- **ARM Parameters Generation**: Export Azure Resource Manager parameters JSON


### 🎉 Version 0.20.67 - Latest Release

**Sizer — JSON Import fixes (#207)**
- **CPU socket count is now respected when importing an Azure Local machine JSON.** Previously the sockets dropdown would always show **1 socket** even when the machine JSON reported `"numberOfCpuSockets": 2` or `"processorCount": "2"` — a heuristic was unconditionally overriding the imported value. The heuristic now only fires when the JSON value is missing or invalid.
- **Total core count is now reconciled correctly** between `hardwareProfile.processors[].numberOfCores` (per-socket) and `detectedProperties.coreCount` (total). Real-world payloads that omit `hwProfile.numberOfCpuSockets` (e.g. ASEPRO2 machines) used to show 20 physical cores as `20 × 1 socket` instead of `10 × 2 sockets`. The parser now prefers `detectedProperties` when present and only falls back to multiplying per-socket cores by the socket count when it must.
- **Single-node clusters are detected automatically.** When you set the machines count to `1` in the import preview, the Deployment Type is now forced to **Single Node** (Hyperconverged is not a valid 1-node configuration).
- **Storage Resiliency now matches the cluster size.** Importing a 3-, 4-, or 16-node cluster now auto-selects **Three-way Mirror**; 2-node clusters keep **Two-way Mirror**. Previously the import always left the default `Two-way Mirror` value.
- **New deployment-type prompt before applying the import.** The Parse & Preview screen now asks whether the cluster is **Hyperconverged** or **Rack-Aware Cluster**, so the Sizer initialises with the correct topology (Single Node still auto-applies if you set machines = 1).
- **Rack-Aware Cluster machine-count validation.** Rack-Aware Cluster only supports **2, 4, 6, or 8 machines**. The import preview now shows an inline error and disables the Load button until the count is valid (or the user switches back to Hyperconverged).
- **"Apply Configuration" renamed to "Load Cluster Configuration"** to better describe what the button does — it loads the parsed Azure Local Machine JSON into the Sizer's running configuration.
- **Memory dropdown now preserves non-standard DIMM totals** via a custom option (mirrors how CPU cores work). An imported lab-VM with 80 GB no longer silently rounds to 64 GB — the dropdown gains an `80 GB (imported)` entry and the value is honoured by the sizing math.
- **S2D capacity-disk count and size are now captured directly in the import preview.** Azure Local JSON does not expose the cluster's S2D data disks, so the preview now asks for them up-front (defaults: 4 × 3.84 TB) and applies them to both the single-tier and tiered capacity-disk selectors when the cluster is loaded — accurate sizing on first calculation rather than after manual fix-up.
- **5.68 TB SSD added to all capacity-disk dropdowns** to match a customer-reported drive size sitting between the existing 3.84 TB and 7.68 TB options.
- **Re-clicking *Parse & Preview* no longer resets your in-preview selections.** If you have already parsed the JSON once and customised the machine count, deployment type (Hyperconverged / Rack-Aware), or S2D disk count / size, an accidental re-click of the button now preserves those values instead of silently snapping them back to the defaults.
- **Test coverage added**: 30 new regression tests under `tests/index.html` ("Issue #207") cover all of the above plus boundary conditions (1, 2, 3, 4, 5, 8 nodes; Hyperconverged vs Rack-Aware; valid/invalid `numberOfCpuSockets`; ASEPRO2-shaped JSON; 80 GB lab-VM memory; custom memory option injection; S2D disk-count and disk-size apply path including 5.68 TB). An additional integration test ("JSON import → Configure in Designer handoff") verifies that values from imported JSON correctly flow through the Sizer DOM into the Designer payload.

**Security & code-quality release**
- **No end-user feature changes** in this section — it tightens the build, dependency, and CI surface so future work is safer to land.
- **All third-party JS libraries vendored locally** (`vendor/html2canvas-1.4.1.min.js`, `vendor/jspdf-4.2.1.umd.min.js`, `vendor/three-0.128.0.min.js`, `vendor/three-OrbitControls-0.128.0.js`). The Designer, Sizer, and Configuration Report pages no longer fetch any runtime JavaScript from `cdn.jsdelivr.net`. Firebase analytics (loaded from `gstatic.com`) is unchanged. Offline / air-gapped users no longer need an internet round-trip for the rack 3D viewer or PDF export.
- **CSS lint added to CI** (`stylelint` with `custom-property-no-missing-var-function` and `color-no-invalid-hex`). Catches the bug class that surfaced earlier this cycle (undefined CSS custom properties).
- **CodeQL security scanning** workflow added (`.github/workflows/codeql.yml`) — runs `security-and-quality` queries on every PR and weekly.
- **`npm audit --audit-level=high`** added as a CI gate so new high-severity advisories block merges. `basic-ftp` override bumped to `>=5.3.1` to clear advisory `GHSA-rp42-5vxx-qpwr`. `npm audit` is currently clean.
- **PPTX export smoke test** added (`scripts/smoke-test-pptx.js`) — runs in CI to verify the PowerPoint export produces a valid ZIP / OOXML file end-to-end.
- **Code-quality cleanup**: replaced two silent `catch (e) {}` blocks with `console.warn` (`switch-config/switch-config.js`) and explanatory comments (`report/report.js`); replaced deprecated CSS keywords (`word-break: break-word`, `page-break-inside: avoid`) with their modern equivalents; removed the unreferenced `docs/outbound-connectivity/styles_backup.css`.
- **ESLint convention documented** in `docs/ESLINT_CONFIG_NOTES.md`: every empty `catch` must include an inline comment explaining why the error is safe to swallow.
- **Anonymous usage counters added to the ToR Switch Configuration page** — Firebase counters (`switchConfigGenerated`, `qosAuditAnalyzed`, `pageViews`) increment when **Generate Switch Configurations** or **Analyze QoS Configuration** complete successfully, and on page view. Increment-only via Firebase server-side `increment(1)`; no switch-config content, IPs, hostnames, or pasted running-config text is ever transmitted.
- **Two new stat tiles** — **ToR Switch Configs** and **ToR Switch QoS Audits** — surface the new counters next to the existing Visitors / Designs / Sizes / ARM Deployments tiles on the Designer, Sizer, and (now) ToR Switch Configuration pages. Six tiles are arranged 3+3 on desktop and 2×3 on mobile.
- **Shared `js/stats-bar.js` component** renders the six-tile counter strip from a single source on every page that needs it; eliminates three drifted hand-maintained copies of the same markup.
- **ToR Switch tab added to the shared top nav** (`js/nav.js`). The Designer, Sizer, and ToR Switch Configuration pages now show a consistent `Designer | Sizer | ToR Switch | Knowledge` tab bar — the three "doing" tabs sit together first, with the reference / docs tab last. The old one-off `page-header-bar` on the switch-config page has been removed.
- **ToR Switch Configuration page — header layout matches Designer and Sizer.** The page now uses the same `header-title-wrapper` / `header-logo-wrapper` / `header-version` markup as the Designer and Sizer, including the ODIN logo, version label, and What's New link. The same disclaimer banner is rendered above the header.
- **ToR Switch Configuration page — stat tiles now show real counts.** The page rendered the six-tile bar but every value stayed at `—` because `js/utils.js` (which defines `formatNumber()`) was not loaded; `fetchAndDisplayStats()` threw a silent `ReferenceError` before populating any tile. The page now loads `../js/utils.js` alongside `../js/analytics.js` and `../js/stats-bar.js`, so all six counters populate correctly.

> **Full Version History**: See [Appendix A - Version History](#appendix-a---version-history) for complete release notes.

---

## Getting Started

### Quick Start

1. **Open the ODIN designer wizard**:
   - Open in a modern web browser, navigate to ODIN online version: https://aka.ms/ODIN-for-AzureLocal
   - For offline or local access, download the source code of this repo, to run a local web server: `PowerShell.exe -ExecutionPolicy Bypass -file .\tests\serve.ps1` (then open address http://localhost:5500 using browser)

2. **Unsure about hardware? Start with the Sizer**:
   - Open the **ODIN Sizer** from the main page or navigate to `sizer/index.html`
   - Add your workloads (VMs, AKS, AVD) and configure cluster type, resiliency, and growth headroom
   - Review the recommended hardware (CPU, memory, storage, GPUs, power, and rack space)
   - Click **Configure in Designer** to transfer the sizing results into the Designer wizard automatically

3. **Follow the wizard**:
   - Answer questions about your deployment scenario
   - Configure network settings, storage, and identity options
   - Review the configuration summary in real-time

4. **Export your configuration**:
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
| **Disaggregated** | External SAN storage (Fibre Channel / iSCSI) with Clos leaf-spine fabric | Up to sixty-four machines across multiple racks |
| **Multi-Rack** | Scalable, multi-rack distributed architecture, that can scale up one hundred and twenty-eight machines | High availability, large scale |
| **Disconnected** | Air-gapped operation with local management | Isolated / security-sensitive environments |
| **Microsoft 365 Local** | Microsoft 365 workloads with minimum 9 nodes | Microsoft 365 on-premises deployments |

### Network Intents (Hyperconverged)

| Intent | Description | Adapters |
|--------|-------------|----------|
| **All Traffic** | Single intent for management, compute, and storage | 2 adapters |
| **Compute + Management** | Shared network for VMs and management, dedicated storage | 4+ adapters |
| **Compute + Storage** | Combined compute and storage traffic, dedicated management | 4+ adapters |
| **Custom** | User-defined adapter-to-intent mapping | Flexible (2–8 adapters) |

Disaggregated deployments use a separate intent model with external SAN storage (Fibre Channel or iSCSI) and a Clos leaf-spine fabric — see the **Disaggregated Architecture Wizard** for details.

### Storage Connectivity

| Type | Description | Requirements |
|------|-------------|--------------|
| **Switched** | Traditional ToR switch-based storage networking | ToR switches, any supported scale |
| **Switchless** | Direct node-to-node storage connections | 2–4 nodes, no storage switches |

### Companion Tools

| Tool | Purpose |
|------|---------|
| **ODIN Sizer** | Workload-driven hardware sizing (VM, AKS Arc, AVD) — calculates CPU, memory, storage, GPU, power, and rack-space requirements with a 3D rack visualization. Transfers cluster type and node count into the Designer. |
| **Switch Config Generator** | Generates example ToR / BMC / border switch configurations for Cisco NX-OS and Dell OS10, with rack-aware support and infrastructure token replacement. |
| **QoS Validator** | Validates a pasted `show running-config` (Cisco) or `show running-configuration` (Dell OS10) against Azure Local QoS requirements (PFC, ETS, ECN, MTU 9216, system QoS policy, interface-level PFC/trunking). |
| **Knowledge Tab** | Embedded outbound connectivity architecture guide and AzLoFlows interactive flow-diagram builder. |

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

### Configuration Report
- Comprehensive configuration report covering deployment scenario, network, intents, IP plan, identity, security, and SDN options
- Download as **Word** (DOCX-compatible), **Markdown** (with embedded diagrams), or **PowerPoint** (template-driven `.pptx` deck)
- Includes decision rationale, network diagrams (SVG / Mermaid / draw.io), and a 2D rack diagram
- Print-friendly formatting (browser "Save as PDF" supported)

### Sizer Report
- **Save as PDF** and **Download Word** for sized hardware results
- Includes per-workload breakdown, hardware configuration, capacity bars, and power / heat / rack-space estimates

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

---

## Report an Issue and Contributing

- Report bugs or request new features via GitHub [Issues](https://github.com/Azure/odinforazurelocal/issues)
- Include browser version, OS, screenshot if possible, and steps to reproduce the issue
- Provide exported config (sanitized) if required to recreate the problem

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

### Published Site Surface Area
The live site at `https://azure.github.io/odinforazurelocal/` is published via GitHub Pages (Jekyll). The root [`_config.yml`](_config.yml) excludes local-only folders from publication to keep the public surface minimal:

- `tools/` — Playwright demo video recording (local dev only)
- `scripts/` — Node.js build / export / generator scripts
- `tests/` — local test harness
- `test-results/` — CI output artifacts
- `docs/archive/` — historical markdown not linked from the site
- `node_modules/`, `package*.json`, lint configs, `CONTRIBUTING.md`

The source of these files is still visible on GitHub — this is a surface-reduction measure, not a secrecy measure.

### Demo Video Tooling (Playwright)
The [`tools/`](tools/) folder contains scripted [Playwright](https://playwright.dev/) demos for producing short walkthrough videos (e.g. for LinkedIn or the README). Playwright is Apache 2.0 licensed, a `devDependency` only, and never runs on the published site. See [`tools/README.md`](tools/README.md) for setup and safety rules. Demo scripts must only target `http://localhost:5500` and must not include credentials or real tenant data.

---

## Additional Resources

### Official Documentation
- [Azure Local Documentation](https://learn.microsoft.com/azure/azure-local/)
- [Network Reference Patterns](https://learn.microsoft.com/azure/azure-local/plan/network-patterns-overview)
- [Azure Arc Documentation](https://learn.microsoft.com/azure/azure-arc/)
- [Azure Local Pricing](https://azure.microsoft.com/pricing/details/azure-local/)

### Community
- [Azure Arc - TechCommunity](https://techcommunity.microsoft.com/category/azure/blog/azurearcblog)
- [Azure Local - GitHub Supportability Forum](https://github.com/Azure/AzureLocal-Supportability)

---

## License

Published under [MIT License](/LICENSE). This project is provided as-is, without warranty or support, it is intended for planning and automation example purposes. See official Azure documentation for deployment guidance and support.

---

## Acknowledgments

Built for the Azure Local community to simplify network architecture planning and deployment configuration.

**Version**: 0.20.67  
**Last Updated**: April 2026  
**Compatibility**: Azure Local 2506+

---

For questions, feedback, or support, please visit the [GitHub repository](https://github.com/Azure/odinforazurelocal) or consult the official Azure Local documentation.

---

## Appendix A - Version History

For detailed changelog information, see [CHANGELOG.md](CHANGELOG.md).

### 🎉 Version 0.20.x Series (April 2026)

#### 0.20.67 - Security & Code-Quality Release
- **Sizer JSON Import fixes (#207)**: CPU sockets now respected from machine JSON (was always forced to 1); per-socket vs total cores reconciled correctly (a 2&times;10 = 20-core ASEPRO2 machine no longer shows up as 20 &times; 1 socket); 1-node imports auto-switch Deployment Type to **Single Node**; resiliency auto-upgrades to **Three-way Mirror** for 3+ node imports; new Hyperconverged vs Rack-Aware prompt with machine-count validation; "Apply Configuration" renamed to "Load Cluster Configuration"; memory dropdown preserves non-standard DIMM totals via a custom option (e.g. 80 GB); S2D capacity-disk count and size captured in the import preview and applied to both single-tier and tiered selectors; 5.68 TB SSD added to all capacity-disk dropdowns; re-clicking *Parse & Preview* no longer resets in-preview selections. 30 new regression tests cover all of the above.
- **No other end-user feature changes.** Tightens the build, dependency, and CI surface so future work is safer to land.
- **All third-party JS libraries vendored locally** (`vendor/html2canvas-1.4.1.min.js`, `vendor/jspdf-4.2.1.umd.min.js`, `vendor/three-0.128.0.min.js`, `vendor/three-OrbitControls-0.128.0.js`). Designer, Sizer, and Configuration Report no longer fetch any runtime JavaScript from `cdn.jsdelivr.net`. Firebase analytics (loaded from `gstatic.com`) is unchanged.
- **CSS lint added to CI** (`stylelint` with `custom-property-no-missing-var-function` and `color-no-invalid-hex`).
- **CodeQL security scanning** workflow added (`.github/workflows/codeql.yml`) — runs `security-and-quality` queries on every PR and weekly.
- **`npm audit --audit-level=high`** added as a CI gate. `basic-ftp` override bumped to `>=5.3.1` to clear advisory `GHSA-rp42-5vxx-qpwr`.
- **PPTX export smoke test** added (`scripts/smoke-test-pptx.js`) — verifies the PowerPoint export produces a valid OOXML file end-to-end.
- **Code-quality cleanup**: silent `catch (e) {}` blocks documented or replaced with `console.warn`; deprecated CSS keywords (`word-break: break-word`, `page-break-inside: avoid`) replaced with modern equivalents; unreferenced `docs/outbound-connectivity/styles_backup.css` removed.
- **ESLint convention documented** in `docs/ESLINT_CONFIG_NOTES.md`.
- **Tab navigation reordered** to `Designer | Sizer | ToR Switch | Knowledge` so the three "doing" tabs sit together first, with the reference / docs tab last.
- **ToR Switch page parity fixes**: stat tiles now populate (was missing `js/utils.js`), and the page header now matches Designer / Sizer (logo, version, What's New link, disclaimer banner).
- **First-visit walkthrough + Help button on the ToR Switch page**: a 3-step Welcome / Generator / QoS Validator overlay appears once on first visit (gated by `localStorage`), and the shared nav-bar Help (?) button now re-launches the same overlay on demand from the ToR Switch tab.
- **New "Workloads" slide in the PowerPoint export** of the Configuration Report: when the report was started from the Sizer, the generated PPTX now includes a dedicated Workloads slide (right after Node Configuration) with one bullet per VM / AKS Arc / AVD workload plus a Subtotal sub-bullet. The slide is automatically skipped for non-Sizer reports.
- **PowerPoint slide "Rack Configuration" renamed to "Node Configuration"** — the slide content is per-node hardware (CPU, memory, disks, resiliency, cluster type), so the new title describes what it actually shows.

#### 0.20.09 - Configuration Report: PowerPoint Export
- **📊 Download PowerPoint button** on the Configuration Report page generates a styled `.pptx` deck (template-driven via `report/template/OdinPPTTemplate.potx`).
- **Slide coverage**: Deployment Scenario & Scale, Physical Network, Rack Configuration, Leaf & Spine Architecture, AKS Reachability & Routing Hops, Host Networking & Intents, Outbound Connectivity, Proxy, Security Configuration, Private Endpoints, Infrastructure Network — with a hero cover and closing slide.
- **Microsoft Learn reference hyperlinks** per network pattern (FC no-backup / FC with backup / single-node / 2-node switchless / 3-node switchless / 4+ switchless / 2-node switched / 3+ switched), plus dedicated links for Private Endpoints and Arc Gateway.
- **Visual extras**: ✓/✗ run coloring on the Security slide, red callout banner where Arc Private Link is unsupported, footer subnet-utilisation raster on Infrastructure Network, rack diagram on Physical Network.
- **Client-side only**: PPTX is generated in the browser via vendored JSZip — no telemetry, no backend, works offline.

#### 0.20.08 - Disaggregated: iSCSI 4-NIC physical paths
- **iSCSI 4-NIC physical shared paths** in host-networking diagrams (wizard preview + report 2-node view): NIC3/NIC4 stay standalone physical adapters carrying Cluster A/B and iSCSI Path A/B with no SET, no vSwitch, and no host vNICs.
- **6-NIC + Backup correction**: `ClusterBackupSwitch` remains only for Cluster/Backup on NIC3/NIC4; dedicated iSCSI remains on NIC5/NIC6.
- **Shared vs dedicated iSCSI overrides**: 4-NIC iSCSI derives from Cluster A/B VLAN/subnet values. Dedicated iSCSI A/B override cards appear only for `iscsi_6nic`, including 6-NIC + Backup.
- **Dedicated iSCSI defaults** updated to VLAN `300` / `400` and subnets `10.30.30.0/24` / `10.40.40.0/24`.
- **vNIC label readability** remains for layouts that genuinely render host vNICs, such as Management + Compute and 6-NIC + Backup Cluster vNICs.

#### 0.20.07 - Knowledge Tab: Context-Aware Help Button
- **Knowledge Help button**: The nav-bar Help button on the Knowledge tab now shows a dedicated walkthrough for whichever sidebar topic is active — the **Outbound Connectivity Architecture Guide** (same-origin written reference) or **AzLoFlows** (external interactive diagram builder). Previously it fell through to the Designer onboarding because the original same-origin flow-diagram pages were replaced by AzLoFlows and the cross-origin `contentWindow.showFlowOnboarding()` probe in `nav.js` could no longer reach the embedded page.
- **Removed orphan pages**: `docs/outbound-connectivity/azure-local-public-path-dark-flows.html` and `azure-local-private-path-dark-flows.html` were no longer linked from anywhere after the AzLoFlows integration.

#### 0.20.06 - Disaggregated Architecture, ToR Switch Config Generator & QoS Validator
- **Disaggregated Architecture Wizard**: New end-to-end wizard for disaggregated deployments with external SAN storage (Fibre Channel, iSCSI 4-NIC, iSCSI 6-NIC) and Clos leaf-spine fabric — up to 64 nodes across multiple racks, with VLAN/VNI/VRF configuration, QoS policy, IP planning, drag-and-drop NIC-to-intent mapping, breadcrumb navigation, and interactive SVG rack topology diagrams
- **ToR Switch Config Generator & QoS Validator**: Full-featured switch configuration page for Cisco NX-OS and Dell OS10 platforms — generates ToR, BMC, and border switch configs with rack-aware 4-ToR support, infrastructure token replacement, JSON export. Paste a `show running-config` (Cisco) or `show running-configuration` (Dell OS10) to validate PFC, ETS, ECN, MTU 9216, system QoS policy, and interface-level PFC/trunking against Azure Local requirements
- **Cisco Nexus 93108TC-FX3P as ToR**: Added 10GBASE-T copper switch model as a ToR option (in addition to existing BMC role)
- **Per-Rack Site / Location**: Rack-aware deployments support separate Site / Location for Rack 1 and Rack 2 (SNMP location)
- **Report: 2D SVG Rack Diagram**: Static front-view SVG rack diagram with server nodes, ToR/BMC switches, core switch box, rack-aware layout, contiguous node numbering, Azure Local branding, legend, and downloadable SVG
- **3D Rack Viz Improvements**: Azure Local branding, BMC switch in every rack, dark grey ToR color, single-node topology, label cleanup
- **Designer: Management VLAN guidance**: Improved VLAN option descriptions and expanded info box
- **Designer → Switch Config**: "Generate / Validate ToR Switch Configuration" button opens switch config page in new tab
- **Sizer: Disaggregated Storage**: New deployment type with rack count (1–4), spine switch count (2/4), storage connectivity (FC/iSCSI), multi-rack 3D visualization with FC switches and per-rack uplinks
- **Sizer: Designer → Sizer Transfer**: Disaggregated architecture transfers with rack count, spine count, and storage type
- **Sizer: Import/Export**: Disaggregated state persisted in save, resume, and JSON import/export
- **QoS Validator**: Smart PFC detection using QoS service-policy, dynamic CoS value detection, actionable warning messages
### 🎉 Version 0.18.x Series (March 2026)

#### 0.18.04 - Sizer: 3D Rack Visualization
- **3D Rack Visualization**: Interactive 3D preview of the estimated rack layout using Three.js (MIT) — renders 42U open-frame server cabinets with detailed 2U server nodes (disk bays with pull handles, status LEDs, Azure logo, dual PSUs, network ports, BMC port, ventilation grille) and 1U ToR switches (48-port ethernet in two rows, QSFP uplinks, fan vents)
- **Rack-Aware Support**: Rack-aware deployments render two side-by-side cabinets with balanced node distribution, blue core switch/router above racks
- **Network Topology**: Rack-aware view includes management/compute uplink cables (blue) from each ToR to the core router, SMB storage trunk cables (pink) between cross-rack ToR pairs, and LAG inter-switch links (orange) between paired ToRs in each rack
- **Dynamic Updates**: Rack visualization updates in real-time as sizer inputs change (node count, cluster type, disk configuration)
- **Interactive Controls**: Left-click and hold to rotate, scroll to zoom, right-click and hold to move up and down; touch-friendly
- **Azure Branding**: Microsoft Azure logo overlay and Azure "A" logo on each server node front panel

#### 0.18.03 - ARM Parameters: Fix Custom Location Name (#189)
- **Fix Custom Location Name ([#189](https://github.com/Azure/odinforazurelocal/issues/189))**: Fixed a bug where the "Custom Location Name" input field on the ARM Parameters page was not updating the `customLocation` value in the generated parameter JSON — the update code referenced a mismatched key (`customLocationName` instead of `customLocation`)

#### 0.18.02 - Designer: Fix NIC overrideAdapterProperty (#187)
- **Fix NIC `overrideAdapterProperty` ([#187](https://github.com/Azure/odinforazurelocal/issues/187))**: Fixed a bug where disabling RDMA on NICs assigned to the Management+Compute intent (e.g., in a switchless 4+ NIC configuration) would generate `"overrideAdapterProperty": false` in the ARM parameter JSON instead of `true`
- **NIC-Level RDMA Detection**: The ARM intent generator now detects NIC-level RDMA changes made at Step 07 (Port Configuration) and correctly sets the override flag
- **Auto-Disable Flag**: When Step 08 (Intent Overrides) auto-disables RDMA for an intent group because no NICs are RDMA-capable, the adapter property touched flag is now set

#### 0.18.01 - Sizer: GPU Capacity Planning & Total VM Requirements
- **Sizer: GPU Capacity Planning ([#180](https://github.com/Azure/odinforazurelocal/issues/180))**: Full GPU capacity planning based on workload requirements — supports DDA (Discrete Device Assignment) and GPU-P (GPU Partitioning) modes across Azure Local VMs, AKS Arc, and AVD workloads
- **GPU Model Selectors**: DDA and GPU-P modes include GPU model dropdowns that auto-set hardware GPU type and enforce homogeneous configuration across all workloads and nodes (with WORKLOAD badge on locked hardware GPU Type)
- **Per-Model GPU-P Partitions**: GPU-P partition sizes dynamically filter based on the selected GPU model, showing VRAM per partition (e.g., A2 supports up to 1:8 / 2 GB, L40S supports up to 1:16 / 3 GB)
- **GPU Capacity Bar**: New GPU capacity bar chart showing consumed vs available GPUs with N−1 node awareness for maintenance/drain reserve
- **GPU Auto-Scaling**: GPU demand drives node count recommendations and GPUs-per-node auto-scaling (with AUTO badge) up to each model's physical maximum
- **GPU Models Expanded**: Added NVIDIA T4 (16 GB, 70W, max 2/node), RTX Pro 6000 (48 GB, 600W, max 2/node), H100 (80 GB, 700W, max 2/node) with correct maxPerNode, DDA/GPU-P support flags, and AKS compatibility
- **AKS GPU VM Sizes**: AKS workloads show all supported GPU-enabled VM SKUs (T4, A2, A16, L4, L40, L40S, RTX Pro 6000) with fixed vCPU/memory per size — auto-sets hardware GPU type on selection
- **GPU Badge**: Workload cards show a yellow "GPU" badge when GPU-enabled
- **GPU Threshold Warnings**: GPU ≥90% triggers over-threshold warnings, sizing notes, and blocks Designer export — includes notes for physical capacity exceeded vs N−1 capacity exceeded
- **GPU in Reports**: GPU utilization flows through to Sizer Word export, Designer, and Report Generator
- **Knowledge Links**: GPU Requirements sections include links to Microsoft documentation for supported GPU models (Azure Local VMs, AKS Arc) and GPU-P management guide
- **Sizer: Total VM Requirements ([#181](https://github.com/Azure/odinforazurelocal/issues/181))**: New "Total VM Requirements" input mode — allows users to enter aggregate vCPU, memory, storage, and GPU totals directly without per-VM multiplication
- **3:1 vCPU Overcommit Ratio**: Added the missing 3:1 option to the vCPU overcommit ratio dropdown

### 🎉 Version 0.17.x Series (February - March 2026)

#### 0.17.61 - Sizer: Fix Resume Session Banner
- **Fix Resume Banner**: Fixed the "Previous Sizer Session Found" banner appearing unconditionally on every page load, even when no workloads were added — the banner now only appears when there are actual workloads to resume (fixes #178)
- **Fix Start Fresh Re-Save**: Fixed "Start Fresh" immediately re-saving default state, causing the banner to reappear on the next page load

#### 0.17.60 - Sizer: Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest)
- **Intel® 6th Gen Xeon® Expanded**: Expanded the Intel® 6th Gen Xeon® CPU generation in the Sizer to cover the full 8–172 core range from the Azure Local hardware catalog
- **Updated Intel Default**: Intel CPU default changed from 5th Gen Xeon® (Emerald Rapids) to Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest)

#### 0.17.58 - Mobile Layout Fixes & Consistency
- **Sizer Mobile Alignment**: Fixed header, disclaimer banner, stats bar, and Privacy footer not visually aligned with form panels on iOS mobile devices — added matching horizontal padding on mobile
- **Sizer Footer Fix**: Moved Privacy footer inside the container element so it respects max-width and aligns with page content
- **Designer Step-Header Overflow**: Fixed "Unsure? Start with Sizer" button overlapping Step 04 (Cluster Configuration) header on narrow mobile screens — step-header now wraps and sizer-link drops to its own line
- **Sizer Mobile Header Consistency**: Aligned logo size (80px), version text size (11px), and logo ordering (logo above title) with the Designer's mobile layout
- **Designer Title Update**: Renamed from "Odin for Azure Local" to "ODIN Designer for Azure Local" for naming consistency with the Sizer
- **CSS Nesting Fix**: Corrected CSS for hover and active states of `.stat-value` elements so styles apply consistently across browsers

#### 0.17.57 - Individual MANUAL Override Dismiss
- **Per-Field Dismiss**: Each MANUAL badge now includes a small × button to remove that individual override without clearing all overrides
- **Shared Flag Handling**: CPU-related badges (cores, sockets, manufacturer, generation) are linked — dismissing any one clears all four
- **Remove All Button Renamed**: Button renamed to "Remove all MANUAL overrides" for clarity
- **Auto-Scale on Dismiss**: Dismissing a MANUAL override immediately triggers auto-scaling — the field reverts to an optimal value and receives the purple AUTO badge

#### 0.17.56 - Designer-to-Sizer Transfer
- **Designer-to-Sizer Transfer**: New "⚖️ Sizer: Add Workloads to this Cluster" button at the bottom of the Designer — transfers deployment type and node count to the Sizer; enabled once Deployment Type and Nodes are selected
- **Sizer: Designer Import**: Sizer accepts configuration from the Designer — pre-populates cluster type and node count with a confirmation banner; skips saved session prompt when importing from Designer
- **Sizer: MANUAL Node Lock**: Node count from Designer locked as MANUAL — prevents auto-scaling from resizing the cluster
- **Sizer: Workload Persistence**: Prior Sizer session workloads restored on return from Designer; banner shows restored count

#### 0.17.55 - Navigation Consistency, Sizer ALDO Workload Cluster, Header Redesign & Analytics
- **Navigation: Tab-Based Routing**: All top navigation links now use `?tab=` URL parameters for consistent tab switching; parameters cleaned after processing via `history.replaceState`
- **Navigation: Designer Link Bug Fix**: Fixed intermittent bug where clicking Designer from Sizer navigated to Knowledge tab — stale sessionStorage combined with missing `?tab=designer` parameter
- **Knowledge Tab: Session Popup Fix**: Fixed "Previous Session Found" popup appearing incorrectly on the Knowledge tab
- **Knowledge: Flow Diagram Backgrounds**: Flat dark backgrounds (`#111111`) replacing animated stars/space WebGL effects on Public and Private Path flow diagrams
- **Knowledge: Public Path Layout**: Shifted diagram elements down to prevent overlap with the Architecture navigation bar
- **Sizer: ALDO Workload Cluster**: New deployment type integrating disconnected scenario with workload cluster role; prompts for Autonomous Cloud FQDN before transfer; skips region picker
- **Sizer: Deployment Type Rename**: Renamed "Cluster Type" to "Deployment Type" throughout the Sizer
- **Sizer: Header Redesign**: Restructured Sizer header to match Designer layout — centered title, absolutely-positioned logo, and Firebase analytics stats bar
- **Sizer: Disclaimer Banner**: Added disclaimer banner matching the Designer's warning banner
- **Sizer: Preview Badge Removed**: Removed purple "Preview" badge from Sizer navigation link
- **Sizer: Analytics Fix**: Fixed page view statistics not loading — added missing `utils.js` dependency and fallback `fetchAndDisplayStats()` call
- **Sizer: Title Update**: Changed page title to "ODIN Sizer for Azure Local" with updated description
- **Sizer: Configure in Designer Fix**: Fixed "Configure in Designer" navigating to Knowledge tab — added `?tab=designer` to navigation URL
- **Sizer: Import Fix**: Fixed hardware/workload auto-import not applying — `?from=sizer` param preserved during tab URL cleanup
- **Analytics: Visitors Rename**: Renamed "Page Views" to "Visitors" in the stats bar on both Designer and Sizer pages
- **Feedback Link**: Opens GitHub Issues in a full new browser tab instead of a popup window
- **Sizer: Export/Import JSON**: Export and import Sizer configurations as JSON files for sharing or backup — full state persistence including all dropdowns, workloads, and MANUAL overrides
- **Sizer: MANUAL Node Count**: Number of Physical Nodes now supports persistent MANUAL override lock
- **Sizer: Configurable S2D Repair Disks**: New "Capacity Disks Reserved for Repair" dropdown with AUTO/MANUAL support; sizing notes warn when below recommended reservation

#### 0.17.11 - Knowledge Tab Embedded Content & Interactive Outbound Connectivity Diagrams
- **Knowledge Tab: Embedded Content**: Knowledge tab now loads inline within the main page — outbound connectivity architecture guide displayed in an embedded frame with sidebar navigation
- **Knowledge Tab: Interactive Diagrams**: Added interactive WebGL flow diagrams for Public Path and Private Path outbound connectivity, selectable via a left sidebar

#### 0.17.10 - ALDO Management, IRVM1 Auto-Workload, ARB Overhead, Region Picker & Sizer Report
- **Sizer: ALDO Management Cluster Type**: New cluster type — fixed 3-node, all-flash, three-way mirror configuration for ALDO management scenarios; node count locked at 3, storage forced to all-flash, resiliency locked to three-way mirror
- **Sizer: ALDO Minimum Hardware Enforcement**: Automatically enforces documented ALDO minimums — 96 GB memory, 24 physical cores, and 2 TB SSD/NVMe storage per node; 64 GB/node (192 GB total) reserved for the disconnected operations appliance VM and deducted from workload capacity; 960 GB boot disk recommended in sizing notes
- **Sizer: ALDO IRVM1 Auto-Workload**: Fixed infrastructure workload (IRVM1 — 24 vCPUs, 78 GB memory, 2 TB storage) automatically added when ALDO Management Cluster is selected; Add Workload buttons disabled, workload cannot be edited/cloned/deleted; ALDO cores auto-scale floor enforces 24 physical cores minimum
- **Sizer: ARB Overhead**: Azure Resource Bridge appliance VM (8 GB memory, 4 vCPUs per cluster) deducted from available capacity in sizing calculations and capacity bars; consolidated infrastructure overhead sizing note
- **Sizer: MANUAL Override Badges**: Green "MANUAL" badge on any user-edited hardware dropdown — persists across workload add/edit/delete/clone with amber capacity warning when overrides prevent auto-scaling; "Remove MANUAL overrides" button to clear all locks
- **Sizer: Independent Disk Locks**: Disk size and disk count are independently lockable — manually setting one still allows auto-scaling on the other
- **Sizer: Region Picker**: Region selection modal in Sizer before navigating to Designer — Azure Commercial (8 regions) and Azure Government (1 region) toggle; prevents cascade reset that wiped imported cluster configuration
- **Sizer: Three-Way Mirror for 3+ Nodes**: Standard clusters with 3 or more nodes are now locked to three-way mirror only — two-way mirror option removed for 3+ node configurations
- **Sizer: Sizing Notes**: Replaced "RAM" with "memory", updated boot drive text, added spacing around × in storage layout notes, added ALDO knowledge link
- **Report: Sizer Hardware & Workloads**: Full "Hardware Configuration (from Sizer)" section now rendered in the HTML report; new "Workloads (from Sizer)" section shows per-workload details (VM, AKS, AVD) with subtotals; individual workloads transparently passed through Sizer → Designer → Report
- **Report: AKS Arc Network Requirements**: Port/VLAN requirements table (ports 22, 6443, 55000, 65000) shown when AKS workloads are configured, with link to MS Learn documentation
- **Report: Disconnected Network Link**: "Plan your network for disconnected operations" link shown in Connectivity section for disconnected deployment types
- **Report: Firewall Allow List**: Added Firewall Allow List Endpoint Requirements row to the report Connectivity section
- **Designer: Edge 2-Node Switchless Default Gateway**: Fixed the Default Gateway field being empty and disabled — template was using DHCP which caused the gateway field to be disabled; changed to static IP with gateway `192.168.100.1`
- **Sizer: Tiered Storage Fix**: Fixed MANUAL badge not appearing on disk size for all-flash configurations — replaced incorrect tiered detection with `_isTieredStorage()` helper
- **Sizer: ALDO Configure in Designer Fix**: "Configure in Designer" for ALDO Management Cluster now correctly selects the Disconnected scenario with Management Cluster role and prompts for Autonomous Cloud FQDN — previously defaulted to Hyperconverged
- **Sizer: ALDO Analytics Tracking**: Selecting ALDO Management Cluster now increments the Sizer analytics counter, matching workload addition tracking
- **CI: ESLint Fixes**: Added `selectDisconnectedOption` to ESLint globals, fixed `loadTemplate()` try-block indentation (4-space → 8-space), changed `var` to `const` declarations
- **Sizer: ALDO Cluster Type Switch-Back Fix**: Fixed bug where Add Workload buttons (VMs, AKS Arc, AVD) remained disabled and Number of Physical Nodes dropdown stayed greyed out after switching away from ALDO Management Cluster back to Standard or Rack-Aware — `renderWorkloads()` innerHTML replacement destroyed the `#empty-state` DOM element, causing a TypeError that halted `onClusterTypeChange()` before controls could be re-enabled; fixed by caching the element reference at module scope

#### 0.17.04 - Example Template Fix & Regression Tests
- **Example Template Fix (#140)**: Fixed issue where loading an Example Configuration Template resulted in incomplete wizard progress (67–76%) instead of 100% — all five templates now load fully complete
- **Template Loading Race Condition**: Suppressed `updateUI()` during template loading to prevent cascading auto-defaults (intent, storageAutoIp) and disabled card recalculation between `selectOption()` calls
- **Template Data Fixes**: Corrected `ports`, `intent`, `arc`, `rackAwareTorsPerRoom`, `rackAwareTorArchitecture` values across all templates; added missing `privateEndpoints`, `adOuPath`, `adfsServerName`, disconnected fields; removed invalid `switchlessLinkMode` from Edge template
- **Template DOM Restoration**: Fixed AD domain/DNS/OU Path inputs, SDN feature checkboxes, and management card selections not populating after template load due to `selectOption()` cascade resets
- **Edge 2-Node Switchless**: Fixed ports `'2'`→`'4'`, intent `'all_traffic'`→`'mgmt_compute'`, 4-entry portConfig (mandatory for low_capacity + switchless + 2-node); the `updateUI()` HARD BLOCK was wiping all downstream state
- **Template Regression Tests**: Added 46 new CI tests — 5 progress tests, 5 check-count tests, 3 rack-aware zone tests, 5 disconnected template tests, 3 data completeness tests, and 25 updateUI() constraint validation tests

#### 0.17.00 - Disconnected Operations Wizard & Network Diagrams
- **Disconnected Operations Wizard**: Full guided wizard for Azure Local disconnected operations — select Management or Workload cluster role, enter Autonomous Cloud FQDN with validation and confirmation gate, choose Air-Gapped or Limited Connectivity outbound mode
- **Disconnected Cluster Role Selection**: New D1 step for selecting Management Cluster (fixed 3 nodes, hosts disconnected operations appliance VM) or Workload Cluster (1–16 nodes, connects to management cluster via Autonomous Cloud FQDN)
- **Autonomous Cloud FQDN Endpoint**: New D2 step with FQDN input, real-time validation, and confirm/edit gate — all subsequent wizard steps are hidden until FQDN is confirmed
- **Disconnected Context Banner**: "Why Azure Cloud & Region are still required" info banner shown for management clusters during and after FQDN confirmation
- **Disconnected Network Diagrams**: 26 draw.io diagrams covering all intent configurations (fully converged, disaggregated, mgmt+compute, compute+storage, 4-intent, 4-storage, switchless 2/3/4-node, single-node workload with all intent variants) × 2 outbound modes (Limited Connectivity + Air-Gapped)
- **Single-Node Workload Diagrams**: Dedicated diagrams for single-node workload clusters in fully converged (1 intent), mgmt+compute/storage (2 intent), and disaggregated (3 intent) configurations
- **Diagram Routing by Intent**: Automatic diagram selection based on cluster role, node count, intent type, storage configuration, port count, and custom NIC assignments
- **DNS Validation Improvements**: DNS servers are now validated against node IPs and default gateway to prevent conflicts
- **Disconnected Scenario Description**: Updated scenario description with accurate feature availability information

### 🎉 Version 0.16.x Series (February 2026)

#### 0.16.04 - Sizer UI Layout Improvements, Shared Changelog & Bug Fixes
- **Sizer: UI Layout Improvements**: ODIN logo and What's New link added to the Sizer header; Reset button moved into the Workload Scenarios section with a confirmation prompt; Save as PDF and Download Word buttons relocated below the Sizing Notes section
- **Sizer: Shared Changelog Module**: Extracted the What's New changelog into a shared JavaScript module used by both Designer and Sizer pages
- **Sizer: S2D Resiliency Repair Storage Reservation**: 1 × capacity disk per node (up to 4 × capacity disks max) of raw pool space is now reserved for Storage Spaces Direct repair jobs, reducing reported usable storage accordingly
- **Designer: Mobile stats bar 2×2 layout**: Page analytics bar on the Designer home page now displays as a 2×2 grid on mobile devices instead of a single row of 4 items
- **Sizer: "Estimated Power, Heat & Rack Space"**: Updated heading to include "Heat" since the section displays BTU/hr values; power units expanded from "W" to "Watts"; BTU is now a Wikipedia hyperlink
- **Sizer: Mobile layout consistency**: On mobile, the Sizer header now matches the Designer page — ODIN logo and What's New centered at top, title and subtitle below
- **Sizer: iOS Safari Mobile Centering**: Fixed centering of logo, What's New, and title text on iOS Safari mobile devices
- **Sizer: Mobile Logo & Text Size**: Increased logo and What's New text size on mobile for improved readability
- **Sizer: Default 2 Node cluster**: Default cluster changed from 3 Node / Three-Way Mirror to 2 Node / Two-Way Mirror, reducing the default starting hardware cost. Three-Way Mirror is automatically selected when 3+ nodes are configured
- **Security: Removed invalid meta tags**: Removed `X-Frame-Options` and `X-XSS-Protection` meta tags from all pages (HTTP-header-only directives that are ineffective in `<meta>` tags; `X-Frame-Options` caused a console warning)
- **Sizer: Node Preference over Ratio/Memory Escalation**: The sizer now prefers adding additional nodes before escalating the vCPU-to-pCPU ratio above 4:1 or bumping per-node memory above 2 TB — conservative auto-scaling caps memory at 2 TB and holds ratio at 4:1, with an aggressive pass only when conservative scaling cannot fit workloads
- **Sizer: Auto-Down-Scaling after Aggressive Pass**: After the aggressive pass bumps memory or ratio, a node-reduction loop steps the node count back down while keeping utilization under 90%, re-running conservative auto-scale at each step
- **Sizer: Bug Fixes**: vCPU ratio AUTO badge persistence, label correction, node recommendation memory cap, stale recommendation message, manual hardware override, node count reset, 1.5 TB memory threshold, memory headroom threshold (80%→85%), bidirectional memory & CPU auto-scaling, sizing notes reorder
- **Sizer: Resiliency Sync after Node Recommendation**: Fixed sizing notes showing "Two-way mirror" while the dropdown displayed "Three-Way" — resiliency variables are now re-read after `updateNodeRecommendation()` changes the dropdown
- **Sizer: Deterministic Node Estimation**: Fixed adding future growth (e.g. 10%) reducing the recommended node count — `buildMaxHardwareConfig()` no longer reads the stale DOM node count to determine the memory cap, ensuring consistent results regardless of previous state
- **Sizer: AMD Auto-Switch before 6:1 Ratio**: Before escalating the vCPU-to-pCPU ratio from 5:1 to 6:1, the sizer checks if switching to an AMD CPU generation with more physical cores (e.g. AMD Turin 192 cores/socket = 384 dual-socket) would resolve compute pressure at 5:1, keeping the overcommit ratio lower
- **Sizer: Workload Analytics Tracking**: Each new workload added in the Sizer (VM, AKS, or AVD) is now tracked via tracking analytics, to display the "Sizes Calculated" on the main page stats bar
- **Tests: Large Cluster & Scaling Tests**: Added comprehensive test suites for node-weight constants, deterministic memory cap, conservative/aggressive auto-scale modes, large cluster node recommendations, node preference verification, and AMD auto-switch before 6:1 ratio

#### 0.16.03 - Custom Intent 8-Port Zone Restrictions
- **Custom Intent 8-Port Zone Restrictions (#130 follow-up)**: For 8-port custom intent, the wizard now only shows the relevant zones — Management + Compute (required), Compute 1 (optional), Compute 2 (optional), and Storage (required). Removed Management, Compute + Storage, and Group All Traffic zones which are not valid for 8-port configurations.

#### 0.16.02 - Custom Intent 8-Port Compute Intent Fix
- **Custom Intent 8-Port Compute Intent Fix (#130)**: With 8 ports and custom intent, the wizard now offers two distinct compute zones (Compute 1 and Compute 2) instead of merging all compute ports into a single intent group. The Configuration Report diagram and ARM template correctly reflect the separate compute intents.

#### 0.16.01 - UX Improvements, Power Estimates, Auto-Scale Enhancements & Storage Limit Enforcement
- **Sizer: Standardised Disk Size Dropdown**: All disk size inputs replaced with dropdown selects using standard NVMe/SSD capacities (0.96, 1.92, 3.84, 7.68, 15.36 TB), eliminating invalid free-text entries
- **Sizer: Delete Confirmation Dialog**: Deleting a workload now requires confirmation, preventing accidental removal
- **Sizer: Clone Workload**: New clone button to duplicate a workload with all its settings
- **Sizer: Estimated Power & Rack Space**: Per-node power (W), total cluster power, BTU/hr, and rack units (including 2× ToR switches). Based on CPU TDP, memory DIMMs, data + OS disks, GPUs, and system overhead
- **Sizer: AVD Custom Profile Validation**: Warns if custom AVD RAM/vCPU or vCPUs/user values fall outside recommended ranges
- **Sizer: Print Stylesheet**: Improved print/PDF output — hides config panel, results full-width, page breaks avoided
- **Sizer: Keyboard Accessibility**: Escape closes modals; Tab focus trapped inside open modals; first input auto-focused
- **Sizer: OEM Disclaimer**: Subtitle updated to state the tool provides example hardware configurations only
- **Sizer: vCPU Ratio Manual Override**: Users can now manually change the vCPU Overcommit Ratio without auto-scaling overriding their selection. Auto-escalation is locked when the user manually sets the ratio, and resets when workloads are added or removed
- **Sizer: AMD CPU Suggestion Tip**: When Intel cores and sockets are maxed and compute utilization ≥80% (at baseline 4:1 ratio), a tip suggests AMD EPYC Turin as an alternative with higher core counts. Condition uses baseline 4:1 ratio so the tip persists even when auto-scaled to 5:1 or 6:1
- **Sizer: AMD EPYC Turin Core Options**: Updated AMD 5th Gen EPYC Turin to include 144, 160, and 192 cores per socket (maxCores: 192), reflecting the full Turin product line
- **Sizer: Auto-Scaled Field Visual Indicators**: Hardware fields that are auto-scaled now show a purple border glow animation and an "AUTO" badge on their labels, providing clear visual feedback on which settings were automatically adjusted
- **Sizer: Capacity Label Renames**: "Capacity Breakdown" renamed to "Capacity Usage for Workload"; sub-labels now include "- Consumed" suffix for clarity
- **Sizer: Infrastructure_1 Volume Deduction**: 256 GB usable capacity reserved by Storage Spaces Direct (Infrastructure_1 volume) is now deducted from overall usable storage in all capacity calculations, with a sizing note
- **Sizer: Disk Bay Consolidation**: When auto-scaling would fill ≥50% of available disk bays, the sizer now evaluates larger disk sizes and selects fewer, larger disks to leave bays free for future expansion, with a sizing note explaining the optimisation
- **Sizer: Storage Limit Enforcement**: Configurations exceeding 400 TB per machine or 4 PB per storage pool are now flagged with 🚫 errors, a red warning banner, and export/Configure in Designer are blocked until corrected
- **Sizer: Dead Code Cleanup**: Removed unused dual parity option, dead functions, and consolidated resiliency constants
- **Sizer: Power Estimate Core Scaling**: CPU TDP in the power estimate now scales with the selected core count (40% base + 60% proportional), so reducing cores visibly reduces estimated power
- **Sizer: Single Node Default Resiliency**: Single-node clusters now default to Two-Way Mirror instead of Simple (No Fault Tolerance)
- **Sizer: Cluster Type & Nodes Label Styling**: Bolder weight, larger font, and primary text colour for Cluster Type and Number of Physical Nodes labels
- **Sizer: Disk Consolidation Count Fix**: Fixed consolidation only increasing disk count — now bidirectional; stale counts no longer persist after page refresh/resume
- **Sizer: Consolidation Note After Headroom**: Fixed consolidation sizing note showing wrong disk count when headroom pass added extra disks
- **Sizer: HTML Validation Fix**: Encoded raw `&` as `&amp;` in the sizer heading
- **Sizer: AUTO Badge Persistence Fix**: Fixed AUTO badges disappearing from CPU Cores and Memory fields when adding workloads that scale nodes without changing per-node values

### 🎉 Version 0.15.x Series (February 2026)

#### 0.15.98 - Default Gateway Field Fix for Safari
- **Default Gateway Field Fix for Safari (#98)**: Fixed the Default Gateway input in Step 15 (Infrastructure Network) becoming unclickable on Safari. The field is now properly disabled/enabled alongside its sibling inputs, ensuring consistent compositing behaviour across all browsers.

#### 0.15.97 - Dynamic Storage Networks for Switched Storage
- **Dynamic Storage Networks for Switched Storage (#113)**: Switched storage configurations with more than 2 RDMA NICs now dynamically generate the correct number of storage networks, VLANs, and ARM storageNetworkList entries (up to 8 per Network ATC). Previously hardcoded to 2 networks regardless of NIC count.

#### 0.15.96 - DIMM-Symmetric Memory, Expanded Disks & vCPU Overcommit
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
- **Cost Estimator**: See [Azure Local Pricing](https://azure.microsoft.com/pricing/details/azure-local/) for cost estimates
- **CIDR Calculator**: Built-in subnet calculator
- **Real-time Validation**: Instant input feedback

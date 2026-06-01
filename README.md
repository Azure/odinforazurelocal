# ODIN for Azure Local

## Version 0.22.01 - Available here: https://aka.ms/ODIN

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


### 🎉 Version 0.22.01 - Latest Release

> **Improves the Sizer's physical-host compute reserve / overhead model** (issue #232), **reorients the rack-layout diagrams** to fill bottom-up with real node names (issue #233), **removes the deprecated Low Capacity deployment type** (issue #234), and **refines the imported Azure Local instance experience** in the Sizer (issue #235).

**What changed**
- **S2D-aware host compute reserve (issue #232)** &mdash; the Sizer no longer applies a single flat percentage for host overhead. New helpers in [`sizer/sizer.js`](sizer/sizer.js) size the reserve by cluster type and storage shape:
  - **CPU**: ALDO management `max(ceil(20%), 2)`; disaggregated `max(ceil(10%), 1)`; standard S2D `max(ceil(10%), 2)` physical cores per node.
  - **Memory**: base **32 GB** (S2D) or **24 GB** (disaggregated) + S2D cache-metadata `ceil(4 GB × cacheTB)` + **64 GB** when ALDO management is hosted, floored at **8 %** of host RAM.
- The reserve is now applied consistently across node-count recommendation, the AMD core-upgrade path, hardware auto-scaling, the capacity bar, sizing notes, and the growth projection.
- A new collapsible **"Physical host compute overhead &mdash; assumptions & math"** section under the Sizer notes shows the memory and CPU reserve math as tables, lists the assumptions, and links to the public Hyper-V / S2D / Azure Local system-requirements docs.
- **Rack-layout diagrams now fill bottom-up (issue #233)** &mdash; all four generators in [`report/rack-svg.js`](report/rack-svg.js), the 3D view in [`sizer/rack3d.js`](sizer/rack3d.js), and the wizard preview in [`js/disaggregated.js`](js/disaggregated.js) stack servers from the bottom of the rack upward, with ToR / leaf / BMC switches kept at the top (FC switches at U1-U2). The 2D report and 3D view stay consistent.
- **Real Designer node names surface in the diagrams** &mdash; new `getRackNodeLabel()` / `getRackTorLabel()` helpers resolve each node's display name (by global index across multi-rack layouts) from the saved config's `nodeSettings`, falling back to `Node N` / `ToR N` when unset.
- **Single-rack diagram header spacing fixed** &mdash; the HCI rack-layout minimum SVG width was raised from 380 to 470px so the centred *Rack Layout — Front View* title no longer crowds the *Azure Local* brand badge on single-rack diagrams (2-rack and 4-rack layouts are unchanged).
- **Low Capacity deployment type removed (issue #234)** &mdash; the deprecated *Low Capacity* type is gone from the Designer and Sizer (Designer now offers 5 templates); the cluster-type mapping helpers no longer reference it.
- **Imported Azure Local instance refinements (issue #235)** &mdash; imported hardware (CPU, memory, disk count/size, node count) is now locked to **MANUAL** so auto-scaling can't silently change it; the vCPU overcommit ratio is decoupled from the physical-CPU lock so it still escalates (4→5→6) to fit excess workload on a fixed cluster; a new **Disaggregated Storage** import deployment-type option greys out the S2D capacity-disk picker and drops disks from the equation; the import *Capacity per disk* dropdown now matches the Sizer's (adds 8 / 12 / 16 / 20 TB); and the *Parse & Preview* button is hidden after a clean parse so only *Load Cluster Configuration* remains.
- **Report always lists all 7 security controls** &mdash; the *Security Configuration* section now always lists Drift Control, WDAC, Credential Guard, SMB Signing, SMB Cluster Encryption, BitLocker Boot Volume, and BitLocker Data Volumes as Enabled / Disabled. *Recommended* shows all seven Enabled (wizard defaults); *Customized* reflects each per-control choice. Previously the individual controls appeared only for *Customized*.

**Tests & quality**
- New *Rack layout — bottom-up fill + real labels* test suite plus host-overhead helper, ratio-escalation decoupling, Disaggregated import, and Parse & Preview coverage; all Low Capacity suites removed. ESLint clean across all browser-facing scopes; HTML validation clean; full test suite passes **1,240 / 1,240**.

**Security & hardening**
- Cleared CodeQL alerts #37–#39 (`js/xss-through-dom`) by escaping DOM-derived GPU model names in three Sizer warning messages, and (from the end-to-end review for this release) escaped the imported `clusterName` in the cluster-import toast in [`sizer/sizer.js`](sizer/sizer.js) to close a DOM-XSS gap on the JSON-import path. Bumped the transitive dev-only `brace-expansion` (5.x) override to `>= 5.0.6` (CVE-2026-45149) using a version-selector form that keeps CI's `npm ci` stable across npm 10/11. No runtime or shipped-site impact.

**Notes**
- No data, schema, or PPT-template changes. No new external network calls. Switches remain top-of-rack; only the server stack moves bottom-up.

> **Full Version History**: See [Appendix A - Version History](#appendix-a---version-history) for complete release notes.

---

## Getting Started

### Quick Start

1. **Open the ODIN designer wizard**:
   - Open in a modern web browser, navigate to ODIN online version: https://aka.ms/ODIN
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

**Version**: 0.22.01  
**Last Updated**: June 2026  
**Compatibility**: Azure Local 2506+

---

For questions, feedback, or support, please visit the [GitHub repository](https://github.com/Azure/odinforazurelocal) or consult the official Azure Local documentation.

---

## Appendix A - Version History

For detailed changelog information, see [CHANGELOG.md](CHANGELOG.md).

### Version 0.21.x Series (May 2026)

#### 0.21.14 - Microsoft 365 Local — Medium-Scale reference architecture + shared rack cards for co-located single-node clusters

> **Adds the *Microsoft 365 Local &mdash; Medium-Scale* reference architecture** to the *Microsoft Sovereign Private Clouds* page (Knowledge tab), and visually groups co-located single-node clusters into shared rack cards for both the new Medium variant and the existing Large variant.

- New scale option **M365 Local &mdash; Medium-Scale** (badge `M`) in [`docs/reference-architectures/script.js`](docs/reference-architectures/script.js). Medium-Scale layout: **2 single-node Azure Local clusters** hosting Exchange mailbox servers (rendered as *one shared rack card* with Servers 1 and 2 stacked inside) + **1 three-node Azure Local cluster** hosting Exchange Edge Transport, SharePoint Server, Skype for Business and SQL Server (Servers 3, 4, 5) &mdash; 3 Azure Local clusters / 5 servers total, drawn as 2 cards.
- **Large-Scale refinement**: the 4 single-node Exchange mailbox clusters now share a single rack card (Servers 1-4), and the 2 single-node Edge Transport clusters share another (Servers 5-6). The 3-node SharePoint/Skype/SQL cluster keeps its own card. They remain independent Azure Local clusters with their own quorum / S2D pool / lifecycle &mdash; the merged card just reflects that operators typically co-locate them in the same physical rack.
- **Per-cluster sub-frames**: inside each merged single-node rack card, every server is now drawn inside its own thin dashed *Cluster N* sub-frame, making it visually obvious that every server is an independent Azure Local single-node cluster (one server / one role / its own quorum + S2D pool). Only applies to the M365 Local Medium / Large merged cards.
- The on-screen **SVG diagram** and the **PowerPoint export** pick up the new variant automatically via the existing `tpl.scaleVariants` code path. Storage is fixed at **S2D (local)** (same constraint as Small / Large); the cluster-count chip is hidden (fixed layout); short PPT label registered as `M365 Medium`. ESLint clean; HTML validation clean; full test suite passes.

#### 0.21.13 - Reference architectures: drop misleading `*` on `Azure Local Cluster (up to 128 nodes)` title

> **Cosmetic fix on the Microsoft Sovereign Private Clouds reference architectures page (Knowledge tab).** The *Azure Local Cluster (up to 128 nodes)* title no longer renders with a misleading `*` (Coming soon) suffix &mdash; 128 nodes is documented and supported.

- Removed the stray `comingSoon: true` flag from the `cluster-128` entry in `cardForScale()` in [`docs/reference-architectures/script.js`](docs/reference-architectures/script.js). Both the on-screen SVG diagram and the PowerPoint export now render the title cleanly without the asterisk.
- The unrelated `comingSoon: true` flag on the **logical-isolation** tenancy option (which gates the *Coming soon* badge in the picker) was deliberately left untouched.
- Full test suite passes **1,246 / 1,246**. ESLint clean across all browser-facing scopes; HTML validation clean.

#### 0.21.12 - Designer auto-fill for Infrastructure Network + Disaggregated single-rack overlap fix (issues #221 + #223)

> **Two bug fixes plus a small wizard quality-of-life feature.** Closes [issue #221](https://github.com/Azure/odinforazurelocal/issues/221) (Designer: easier infrastructure-network setup) and [issue #223](https://github.com/Azure/odinforazurelocal/issues/223) (Disaggregated rack diagram: single-rack title / SAN / legend overlap and clipping).

- **Designer · Step 15 — "🪄 Auto-fill from Node IPs" button (issue #221).** New green button next to the existing *Subnet Calculator*. One click derives the **Infrastructure CIDR**, **Default Gateway**, and **Infra IP Pool start/end** from the Node IPs already entered on Step 12. Gateway prefers `.1` (first usable host); pivots to broadcast-1 (`.254` in /24) **only if** a node already uses `.1`. Pool size is fixed at 6 IPs (Cluster IP + 3 ARB + 2 spare), placed past the highest node IP with at least 10 IPs of node-growth headroom; if the gateway sits inside the candidate pool range, the pool is shifted past it. Any field already manually edited (CIDR, gateway, or pool) is silently kept and reported in a toast — e.g. *"Skipped: gateway (kept your manual value)"*.
- **Designer + Configuration Report — live "Infrastructure Subnet Utilisation" diagram.** A horizontal bar diagram (Default Gateway / Infra IP Pool / Node IPs / Unused, with counts per segment) now renders inline below the Step 15 inputs as the user types — same SVG that previously only appeared in the PowerPoint export. The same diagram is also embedded in the *IP, Infrastructure Network & VLAN* section of the on-screen Configuration Report. Single source of truth in new `js/subnet-utilization.js` shared by the wizard live preview, the configuration report, and the PowerPoint export.
- **Disaggregated rack diagram — single-rack overlap + clipping resolved (issue #223).** Two SVG generators render the same diagram (the wizard preview in `js/disaggregated.js` and the configuration report in `report/rack-svg.js`); both previously sized the SVG canvas based on rack count alone, which produced a ~300 px-wide viewBox for a single rack and caused the title to slide under the *Azure Local* brand badge, SAN / iSCSI fabric label boxes to clip the `Connected to FC Switch A in each rack` sub-line, and the legend to run off the right edge. Both generators now compute a content-aware width floor — `Math.max(naturalWidth, titleMinW, sanLabelMinW, legendMinW)` — and centre the rack column inside the widened canvas; the SAN / iSCSI box pair now spans `(svgWidth − 2·padX)` instead of the narrower rack column. `max-width: ${svgW}px` was also removed from both SVG roots so the diagram fills the available container width.
- New `state.infraPoolManual` field registered in all three state-field inventories in `tests/index.html`. ESLint clean; HTML validation clean; full test suite passes **1,246 / 1,246**.

#### 0.21.11 - Sizer hardware-options alignment with the Azure Local Solutions Catalog (issue #226)

> **Sizer hardware-options alignment with the Azure Local Solutions Catalog.** A new automated build-time gap check compares every Sizer dropdown against a captured catalog snapshot and writes a gap report after the browser test suite. The Sizer now offers NVIDIA **A100** and **A40** GPUs, **xeon-5th up to 128 cores/socket**, **xeon-6** with **36** and **80** core options added, **40-drive capacity nodes** (single-tier and two-tier), **8 / 12 / 16 / 20 TB capacity drive sizes**, and a **12.8 TB cache** size — matching what Azure Local certified hardware ships today. Closes [issue #226](https://github.com/Azure/odinforazurelocal/issues/226).

- **NVIDIA A40** added — 48 GB GDDR6, 300 W, up to 2 per node, supports Azure Local VMs / AKS / GPU-P, with `validPartitions: ['1', '1/2', '1/4', '1/8', '1/16']` (NVIDIA vGPU software partitioning, up to 16 vGPUs per GPU).
- **NVIDIA A100** added — 80 GB HBM2e, 300 W, up to 2 per node, supports Azure Local VMs / AKS / GPU-P, with `validPartitions: ['1', '1/2', '1/4', '1/8']`. **A100 uses MIG** (hardware partitioning) with a hard cap of **7 GPU slices** per A100; the dropdown therefore deliberately stops at `1/8` and **does not** include `1/16`.
- **`xeon-5th`** (Intel® 5th Gen Xeon® / Emerald Rapids) core options extended to `[8, 10, 12, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 80, 96, 128]` (was capped at 64); `maxCores: 128`. **`xeon-6`** (Intel® 6th Gen Xeon® / Granite Rapids · Sierra Forest) core options now include **36** and **80**.
- **Capacity drive sizes** — `8 TB`, `12 TB`, `16 TB`, and `20 TB` added to both single-tier and two-tier dropdowns. **Cache drive size** — `12.8 TB` added. **Capacity disk counts** extended to **40 per node** for both single-tier and two-tier.
- **`scripts/catalog-gap-check.js`** + **`tests/fixtures/catalog-snapshot.json`** + **`tests/fixtures/CATALOG_API.md`** — new Node.js gap-check tool with a committed snapshot of the Azure Local Solutions Catalog SPA's POST API response (24 platforms, 42 configurations). `scripts/run-tests.js` now emits `test-results/catalog-gap-report.txt` and `.json` after the browser test suite. Informational only by default; `--strict-catalog-gap` will fail the build on real gaps.
- 6 new GPU_MODELS unit assertions covering A40 + A100 (model definition, VRAM/TDP, `maxPerNode`, partition correctness — including the explicit "no `1/16` for A100" guard). The two `_tryAmdCoreUpgrade` auto-scale tests were re-pegged to `xeon-4th` (max 60 cores/socket, unchanged) because the new xeon-5th 128 cores/socket cap makes the 5:1 → 4:1 step-back path unreachable for that generation. ESLint clean; HTML validation clean; full test suite passes **1,171 / 1,171**. The catalog gap report reports **0 gaps** plus **3 known design exceptions** (memory ceiling deliberately held at 4 TB / per-node; legacy and minor enterprise capacity / cache SKUs deliberately not surfaced).

#### 0.21.10 - Sovereign Private Clouds Reference Architectures: visual polish + PPT export improvements

> **Sovereign Private Clouds Reference Architectures — visual polish + PPT export improvements.** A focused release on the Knowledge tab's reference-architectures page and its PowerPoint export. The on-screen SVG diagram now aligns strict-vs-logical tenant headers identically, groups SAN-using clusters contiguously inside each band so the SAN cylinder visually anchors them, and shows the official Microsoft 365 logo (vector) for the M365 Local purpose. The PPT export gets shorter scale labels with auto-shrink fonts so long combinations no longer overflow, and a new per-purpose **Scale** panel that lists every selected scale with its full title + description.

- **Tenant header alignment unified.** Strict and Logical isolation cards now use the same vertical layout — a small uppercase label (`TENANT — STRICT ISOLATION` / `TENANTS — LOGICAL ISOLATION`) sitting above a dashed-border group that wraps the tenant chips. Strict tenancy synthesizes a single chip from `tenantBadge` so workload areas align byte-for-byte across cards in the same row, regardless of which tenancy was picked. The dashed border no longer overlaps the label.
- **SAN-using clusters grouped together.** Within each band, a stable sort moves SAN-using clusters (cluster-64, cluster-128, plus single-node / cluster-16 clusters where the user chose `SAN` or `S2D + SAN`) to the left so they sit adjacent to each other and the SAN cylinder is centered across only the SAN-using cards. The Control Plane Appliance card stays pinned to position 0 on disconnected bands.
- **M365 Local switched to the official Microsoft 365 SVG logo.** Replaces the older Exchange/SharePoint/Skype trio with the official Microsoft 365 (2022) logo (public-domain SVG sourced from Wikimedia Commons, `docs/reference-architectures/icons/sovereign-m365.svg`) — now used on both the on-screen purpose card / footer chip and the PPT hero card.
- **"RECOMMENDED" badge removed from connectivity options.** The green pill no longer appears on any connectivity card; the `recommendedConnectivity` data field is retained for body copy but no longer drives a visual badge.
- **PowerPoint overview slide ("Your selections") — long scale labels now fit.** New compact label set (`Single Node`, `Rack-Aware (2-8)`, `16 nodes`, `64 nodes`, `128 nodes`, `M365 Small`, `M365 Large`) replaces the long titles inside the Scale pill. The pill is widened (3.5″ → 4.55″), and a new `pillFontSize()` helper auto-shrinks the font down to 7 pt if a particular combination still doesn't fit, so multi-scale rows like `64 nodes + 16 nodes + Rack-Aware (2-8)` always render on a single line.
- **PowerPoint per-purpose slide — new Scale panel with descriptions.** The "Your configuration" area was restructured: compact `TENANCY` and `STORAGE` tiles stack on the left, and a wide `SCALE` panel on the right lists every selected scale on its own row — bold title (e.g. `Azure Local Cluster up to 16 nodes`) followed by the scale's official description (e.g. *"Standard Azure Local cluster — 2 to 16 nodes in a single rack."*). Font sizes inside the panel scale gracefully (1 scale → 14 / 11 pt, 2 scales → 13 / 10 pt, 3 scales → 11 / 9 pt) so all combinations fit in the 1.95″ panel.
- ESLint clean across all browser-facing scopes (zero new warnings); HTML validation clean; full test suite passes (1,160 / 1,160). Smoke test (`node scripts/smoke-test-pptx.js`) confirms the new builder still produces a valid PPTX.

#### 0.21.09 - Designer Step 16: SAN LUN ID inputs hidden for HCI deployments (issue #222)

> **Bug fix.** Resolves [issue #222](https://github.com/Azure/odinforazurelocal/issues/222) — the SAN Volume LUN ID inputs on Step 16 ("Storage Pool Configuration") were shown whenever **InfraOnly** was selected, regardless of architecture. They are only meaningful for the **Disaggregated (create-cluster-san)** ARM template; for **Hyperconverged** deployments they could not be filled in correctly and misled users into thinking they had to enter SAN details before continuing the wizard.

- **Designer · Step 16 — SAN LUN ID section now gated on architecture only.** The two SAN LUN ID inputs (`Infrastructure_1 Volume SAN LUN ID` and `Cluster Performance History Volume SAN LUN ID`) are now hidden whenever `state.architecture !== 'disaggregated'`. HCI clusters have no SAN array, so the inputs are hidden for all three HCI storage-pool choices (*Express*, *InfraOnly*, *KeepStorage*). Disaggregated deployments still require both LUN IDs (gated by `getArmReadiness()` before Generate ARM).
- **No state-machine changes.** `state.infraVolLunId` / `state.infraPerfLunId` continue to be reset when the architecture switches away from Disaggregated. ARM generation, validation (`validateSanLunInputs()`), and the Generate-ARM readiness check were already architecture-gated — the bug was purely in the DOM visibility step (`syncStoragePoolUi()`).
- New unit test in [`tests/index.html`](tests/index.html) covers all four `(architecture × storagePoolConfiguration)` combinations to lock the visibility behaviour. ESLint clean; all 1,160 unit tests pass.

#### 0.21.08 - Security maintenance — `fast-uri` pinned to ≥ 3.1.2

> **Security maintenance release.** Bumps the transitive `fast-uri` npm dependency to `>= 3.1.2` to clear two high-severity Dependabot alerts. No functional, UI, or user-facing changes to the Designer, Sizer, Switch Configuration, Reference Architectures page, or PowerPoint export.

- **`fast-uri` pinned to `>= 3.1.2`** via a new `overrides` entry in [`package.json`](package.json). Resolves [GHSA-q3j6-qgpj-74h6 / CVE-2026-6321](https://github.com/advisories/GHSA-q3j6-qgpj-74h6) (path traversal via percent-encoded dot segments, patched in 3.1.1) and [GHSA-v39h-62p7-jpjc / CVE-2026-6322](https://github.com/advisories/GHSA-v39h-62p7-jpjc) (host confusion via percent-encoded authority delimiters, patched in 3.1.2). The package is pulled in transitively via `html-validate → ajv` and `stylelint → table → ajv` and is used only by the local lint tooling — it is never bundled into the published site.
- Matching guard entry added to `.github/copilot-instructions.md` so future PRs cannot regress the override.
- `npm audit` now reports **0 vulnerabilities**. No new external network calls. No new runtime dependencies. ESLint clean across all browser-facing scopes; all 1,156 existing unit tests still pass.

#### 0.21.07 - Reference Architectures: AVD/Disconnected guard + Foundry Local diagram polish

> Polishes the **Microsoft Sovereign Private Clouds reference architectures** page (Knowledge tab) with five targeted refinements to the Foundry Local cluster diagram, an AVD compatibility guard on the connectivity picker, and tighter AVD workload labelling. No changes to PPT export, Sizer, Designer, or any other surface.

- **AVD ↔ Disconnected guard.** Selecting *Azure Virtual Desktop* in step 1 now disables the *Disconnected / Air-gapped* card in step 2 (AVD requires the AVD control plane in Azure). If Disconnected was already selected, connectivity is force-flipped back to *Connected* and an inline warning is shown under the connectivity grid. Removing AVD restores the disconnected option.
- **Foundry Local cluster — nested AKS Cluster → Foundry Local container.** Outer **AKS Cluster** container holds an inner **Foundry Local** sub-container, with **Edge RAG** and **Video Indexer** tiles inside Foundry Local. Reflects the actual deployment shape (Foundry-hosted services on AKS Arc).
- **Foundry Local cluster — AVAILABLE AI MODELS strip moved above the workload band** so the model logos sit between the department chips and the AKS container.
- **Foundry Local cluster — GPUs pulled out into a dedicated tile** between the *SERVERS* title and the server pills, in the same green palette as the server pills (`#e6f5ee` / `#9bd6b8`) — GPUs are physical hardware that lives on the servers, not a workload.
- **AVD Session Host Cluster** — workloads simplified to **AVD session hosts**, **FSLogix profiles**, and **AVD VMs** (replacing the previous *Domain controllers* + *AKS Arc* tiles).

#### 0.21.06 - Configuration Report PPTX restyled to dark-mode Sovereign look

> Restyles the **Configuration Report PowerPoint export** (Designer's *Download PowerPoint* button) to match the dark-mode visual identity of the *Microsoft Sovereign Private Clouds reference architectures* PPTX export. The two ODIN-generated decks now share a single, consistent look-and-feel — dark `#0A0A0F` backgrounds, white titles with a blue accent underline, rounded-rect content cards with drop shadows, ODIN logo top-right on every section slide, and a centered cover slide. **Bullet content and rasterized SVG diagrams are unchanged** — only the layout, palette, and chrome were rebuilt.

- New from-scratch OOXML builder in `report/pptx-export.js` — replaces the previous template-based pipeline (which fetched `report/template/OdinPPTTemplate.potx` and emitted via placeholders). The deck is now assembled synchronously without a network round-trip.
- Dark-mode palette: `#0A0A0F` background, `#FFFFFF` titles, `#A1A1AA` body, `#1A1A24` card fill with `#2D2D3A` borders, `#0078D4` blue accent underline beneath every title, `#7B68EE` accent purple for cover footer text.
- Cover slide: large 2.2" centered ODIN logo + 40 pt bold white title + 18 pt subtitle + italic purple "Generated on …" footer.
- Section slides: rounded-rect cards with drop shadows hold the bullets and the diagram; ODIN logo top-right on every slide.

#### 0.21.05 - "About this architecture" slide in Reference Architectures PPTX

> Adds an **"About this architecture" slide** to the PowerPoint export on the *Microsoft Sovereign Private Clouds reference architectures* page (Knowledge tab). The slide carries the same on-screen narrative — overview, control-plane explanation, and per-purpose design notes — so the deck now reads end-to-end **Cover → About → Diagram → Control Plane → Summary → per-purpose detail slides** instead of jumping straight from the cover into the diagram with no context.

- Inserted between the existing Cover and Diagram slides. Generated entirely client-side via the already-vendored JSZip 3.10.1.
- Section text reuses the same `buildOverviewParagraph()` / `buildControlPlaneParagraph()` builders that drive the on-screen narrative, so wording stays in lockstep between the page and the deck. The per-purpose block uses the same `tpl.summary` + `tpl.notes` data.
- Body font auto-shrinks (12 → 11 → 10 → 9 pt) when the combined character count grows, so combined multi-purpose architectures (e.g. M365 Local + General Purpose Workloads + Foundry Local) still fit on a single 16:9 slide.
- New `makeRichTextBoxSp()` rich-text frame helper that supports per-paragraph font size, weight, color, alignment and `spcBef` / `spcAft` paragraph spacing in a single OOXML text box.

#### 0.21.04 - Foundry Local, Edge RAG and AI Video Indexer in the Sizer

> Adds **Foundry Local on Azure Local (Preview)**, **Edge RAG Preview, enabled by Azure Arc**, and **Azure AI Video Indexer enabled by Arc (Preview)** as three new top-level workload types in the Sizer alongside Azure Local VMs, AKS Arc, and AVD. Closes [issue #213](https://github.com/Azure/odinforazurelocal/issues/213).

- **Foundry Local** — per-replica AI inference sizing with model size classes (Small SLM / Medium SLM / Large LLM / Custom), inference engine picker (ONNX-GenAI or vLLM), 1–100 replicas, and a 3-node Kubernetes control plane + per-replica + 200 GB OS disk + operator-overhead total.
- **Edge RAG Preview, enabled by Azure Arc** — turnkey 4-VM Retrieval Augmented Generation pipeline (LLM + embeddings + vector DB) sized in GPU mode (4 × NC8_A2 / NC8_A16) or CPU mode, with vector-DB storage scaling from the user's document corpus size.
- **AI Video Indexer enabled by Arc (Preview)** — Microsoft's video and audio analysis pipeline sized to the published Recommended (2 worker / 64 vCPU / 256 GB / 100 GB) or Minimum (1 worker / 32 vCPU / 64 GB / 50 GB) cluster-wide tiers, with optional GPU and a ReadWriteMany storage class hint.
- **Round-trip support** — all three new workload types serialize through JSON Export, JSON Import, share URL, *Configure in Designer* hand-off, and the Configuration Report (Markdown + HTML + PowerPoint).
- **Modern animated Preview banner** in the top-left corner of each Preview workload-type button (Foundry Local, Edge RAG, AI Video Indexer); descriptive multi-line hover tooltips on every workload button (all six), expanding acronyms and explaining what each workload provides.
- **Other UX polish** — Sizer AUTO enforces a 24-core CPU minimum per node when GPUs are involved on multi-node clusters (Low Capacity stays capped at 14); fixed misleading "*based on undefined requirements*" message when GPU was the bottleneck; Foundry model class examples lead with OpenAI gpt-oss models; Configuration Report renames Video Indexer → AI Video Indexer; mobile 3D rack hides the brand badge overlay on viewports ≤ 768 px; top navigation tab order changed to Knowledge | Sizer | Designer | ToR Switch; *Microsoft Sovereign Private Clouds Reference Architectures* is now the first item in the Knowledge tab; new **Share Architecture as URL** button on the Reference Architectures page (mirrors the Sizer's pattern, with property-key whitelisting on the URL-load path to satisfy CodeQL `js/prototype-polluting-assignment`).

#### 0.21.03 - Microsoft Sovereign Private Clouds reference architectures (Preview)

> New **Microsoft Sovereign Private Clouds reference architectures** page (Preview) in the Knowledge tab. Pick a business purpose, see a live SVG diagram of the resulting architecture, and download an editable multi-slide PowerPoint generated entirely client-side via JSZip.

- **`docs/reference-architectures/` — new self-contained Knowledge-tab page** with five business purposes (Azure Local, Microsoft 365 Local, GitHub Enterprise Local, Azure Virtual Desktop on Azure Local, Foundry Local), connectivity / tenancy / topology pickers, a live SVG preview, an *About this architecture* narrative section, and an editable client-side PowerPoint export (Cover, Diagram, Control Plane, Summary, and per-purpose slides) generated via [JSZip 3.10.1](https://github.com/Stuk/jszip) (MIT, vendored at `vendor/jszip-3.10.1.min.js`).
- **Independent of the Designer**: this page does not read or modify your Designer / Sizer / Switch Configuration state.
- **No new external network calls** — all icons, the cover logo, and the deck assembly happen client-side. `docs/Temp/` added to `.gitignore` and `_config.yml` exclude list as defence-in-depth so the local working folder for source decks / extracted PPTX content (which may contain internal Microsoft reference material) can never be committed *and* can never be published via Jekyll.

#### 0.21.02 - Security & Code-Quality Hardening

> Security- and code-quality-hardening release. Resolves the 12 open CodeQL code-scanning alerts on the repository (1 × `js/xss-through-dom`, 11 × `js/remote-property-injection`) and the 8 open AI-generated Code Quality findings. No user-visible behaviour changes.

- **CodeQL `js/xss-through-dom` (Sizer JSON Import preview, alert #15)** — `parseAndPreviewClusterJSON()` now coerces every JSON-derived numeric value (`coreCount`, `coresPerSocket`, `sockets`, `memoryGiB`) to `Number()` immediately before they are interpolated into the preview HTML, making the type-narrowing barrier explicit on the data-flow path from `<textarea>.value` → `JSON.parse(...)` → `previewDiv.innerHTML`. String values were already escaped via `escapeHtml()`.
- **CodeQL `js/remote-property-injection` (alerts #16–#26)** — eleven sites where the code wrote to a JS object using a key derived from user-supplied data (NIC speed strings, network-zone names, intent assignments, drag-and-drop port IDs) hardened against prototype-chain pollution. Ten dictionaries are now created via `Object.create(null)` (`bySpeed` / `bySpeed2` in `report/pptx-export.js`; `groupsByZoneD` / `zoneLeafCountersD` / `buckets` / `groupsByZone` / `zoneLeafCounters` in `report/report.js`). The remaining one (`state.disaggAdapterMapping[portId]` in `js/disaggregated.js`) validates `portId` against `getDisaggPortList()` before using it as a property key.
- **AI Code Quality findings cleared** — `js/stats-bar.js` (`STAT_PLACEHOLDER` constant); `scripts/smoke-test-pptx.js` (size error message); `switch-config/index.html` (Arizona option tag); `tools/demos/generate-disagg-fc-deck.spec.js` (dialog auto-accept logging); `tools/demos/odin-full-walkthrough.spec.js` (configurable `slowMo` via `ODIN_DEMO_SLOWMO`, stable `[onclick*="'aks'"]` / `[onclick*="'vm'"]` selectors).

#### 0.21.01 - Sizer mobile + Rack U / Power fixes

> Closes [#210 — Sizer: Formatting issue when using a mobile device to view sizer](https://github.com/Azure/odinforazurelocal/issues/210).

- **Sizer — Mobile layout fix (iOS / narrow viewports)** ([#210](https://github.com/Azure/odinforazurelocal/issues/210)): Sizer no longer overflows horizontally on iPhone (390px) or other narrow screens. Root cause was the CPU Generation `<select>` (~353px intrinsic width for *"Intel® 4th Gen Xeon® (Sapphire Rapids)"*) holding the `.sizer-layout` 1fr CSS Grid track open, plus flex containers (`.section-header-row`, `.config-row`, `.export-actions`) that didn't wrap. Fixed in `sizer/sizer.css` with `min-width: 0` on the panels, `max-width: 100%` on `.config-row select`, `flex-wrap: wrap` on the three flex rows, and removal of the mobile-only `padding: 0 25px` indents on `<header>` / `.disclaimer-wrapper` / `.sizer-footer` from PR #170. Verified at 390 / 768 / 1024 / 1400 px. Lightning-bolt icon next to *Estimated Power, Heat & Rack Space per Instance* now rendered filled in `--warning` amber (`#f59e0b`).
- **Sizer Rack U / power: BMC switch now counted in non-disaggregated clusters**: Rack-Unit estimate and Network Infrastructure Power now correctly include 1 × 1U BMC switch per rack for Single-node, Standard Hyperconverged, and Rack-Aware deployments — matching what the 3D rack visualization has always rendered. Single-node = 3U / 150W infra (was 2U / 0W); Standard HCI (1 rack) = `nodes × 2U + 3U switches` / 650W infra; Rack-Aware (2 racks) = `nodes × 2U + 6U switches` / 1,300W infra. Power-detail expander now lists ToR and BMC as separate line items.
- **Sizer — Low Capacity: Rack U / Power now reflect compact edge hardware**: Per [Microsoft's networking requirements for low-capacity systems](https://learn.microsoft.com/en-us/azure/azure-local/concepts/system-requirements-small-23h2?view=azloc-2604#networking-requirements), Low Capacity does not require a separate BMC switch and uses at most 1 small edge switch. Cell relabelled to **"Hardware Footprint"** with value *"Tabletop — N appliances + 1 switch"* (or *"Tabletop — standalone appliance"* for 1 node) — no `U` figure, since Low Capacity is not rack-mounted. Infra power corrected: 0W single-node, 50W multi-node (was 650W — ~13× too high).
- **Sizer — Rack Units cell now uses an expandable breakdown** with chevron `▸` next to the value (no more text overlap). Keyboard-accessible (`<button>` with `aria-expanded` / `aria-controls`), hidden for Low Capacity.
- **Sizer — *Capacity Usage for Workload* matches Low Capacity's 3-node limit**: top progress bar now shows *"Azure Local low capacity instance size"* / 3 max for Low Capacity (was `/ 16` Hyperconverged default).
- **Sizer — Disaggregated rack-U: external SAN appliance no longer counted**. Server nodes, ToR, BMC, and FC switches are still counted; the breakdown now ends with *"External SAN storage appliance(s) are not counted — consult your SAN vendor for actual rack-U."*

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
- **Designer “Start Over” now fully resets state.** Previously the reset missed `sizerHardware` / `sizerWorkloads` (so Sizer-imported workloads carried over), `architecture`, and all disaggregated fields. Defaults are now driven from a single source-of-truth factory so adding new state can’t silently bypass Start Over. Theme and font-size preferences are still preserved across a reset.
- **Sizer "Estimated Power, Heat & Rack Space per Instance" panel is now always visible** — previously it was hidden until the first workload was added, even though the figures only depend on the selected hardware and node count. Power, BTU/hr, and rack-unit estimates (plus the 3D rack visualization) now render with real values from the moment you open the Sizer, so you can compare the data-centre footprint of different hardware choices before any workload is defined.
- **Sizer Power & Heat estimates now flow into the Designer report and PowerPoint export.** When you click **Configure in Designer** from the Sizer, the computed power numbers (per-node Watts, total Watts, BTU/hr, rack U, network infrastructure power, per-node component breakdown) are now carried through to `report.html` as a new **Power, Heat & Rack Space (from Sizer)** section and to a dedicated PPT slide of the same name.
- **Single-rack hyperconverged rack diagram in the Designer report no longer renders gigantic.** A tall+narrow rack (e.g. 1 rack × 16 nodes) was being stretched to fill the parent card by default browser SVG sizing, making the title and node tiles many times their natural size. The diagram now caps its upward scaling at the natural intrinsic SVG width while still shrinking on narrow viewports.

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

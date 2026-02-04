# Changelog

All notable changes to Odin for Azure Local (Optimal Deployment and Infrastructure Navigator) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.12.1] - 2026-02-04

### Added

#### Arc Private Link Endpoint Visibility (Issue #29)

- **Arc Private Link Unsupported Notice** - Added Arc Private Link Endpoint to the Private Endpoints selection list as a disabled, non-selectable option with clear "Not supported for Azure Local" messaging. This helps users understand that Arc Private Link is not a valid option for Azure Local deployments.

- **Visual Distinction** - The unsupported option uses a red background styling to clearly differentiate it from selectable options.

### Fixed

- **Azure Container Registry Warning Style** - Updated the ACR warning note to use consistent warning styling (yellow/orange) matching Key Vault and other warning messages.

---

## [0.12.0] - 2026-02-04

### Added

#### ODIN Sizer Tool (Issue #27)

- **Comprehensive Workload Scenario Sizing** - New dedicated Sizer tool at `/sizer/index.html` for calculating Azure Local cluster hardware requirements based on workload scenarios.

- **Workload Scenario Concept** - Create scenarios with multiple workloads to model your infrastructure needs. Each scenario calculates total and per-node requirements.

- **Azure Local VMs Workload** - Add virtual machine workloads with configurable vCPUs, memory, storage, and VM count. Supports both general-purpose and specialized VM configurations.

- **AKS Arc Clusters Workload** - Size Kubernetes clusters with control plane and worker node specifications. Supports multiple clusters per scenario with HA or non-HA control plane options.

- **Azure Virtual Desktop Workload** - AVD workload sizing with three user profiles:
  - Light: Task workers (0.5 vCPU, 2 GB RAM, 20 GB storage per user)
  - Medium: Knowledge workers (1 vCPU, 4 GB RAM, 40 GB storage per user)
  - Power: Power users (2 vCPU, 8 GB RAM, 80 GB storage per user)

- **N+1 Capacity Reservation** - Automatic calculation of maintenance capacity, ensuring workloads can survive a single node failure.

- **Storage Resiliency Options** - Support for three storage resiliency configurations:
  - Two-way mirror (2x raw storage requirement)
  - Three-way mirror (3x raw storage requirement)
  - Dual parity (~1.5x raw storage requirement)

- **Per-Node Requirements** - Clear breakdown of physical core, memory, and storage requirements per cluster node.

- **Capacity Utilization Visualization** - Visual progress bars showing compute, memory, and storage utilization percentages.

- **Sizing Notes & Recommendations** - Dynamic guidance based on workload configuration including high memory warnings and vCPU overcommit ratios.

- **Firebase Analytics Integration** - Sizer page includes analytics tracking for page views, consistent with other ODIN pages.

---

## [0.11.0] - 2026-02-04

### Added

#### Tab Navigation System (Issue #24)

- **Top Navigation Bar** - New fixed navigation bar at the top of the page with ODIN branding and tab buttons for Designer, Knowledge, and Sizer sections.

- **ODIN Designer Tab** - The existing wizard functionality is now accessible via the Designer tab, which is the default active view.

- **ODIN Knowledge Tab** - Quick access to the documentation section, linking to the Outbound Connectivity Guide and future knowledge base articles.

- **ODIN Sizer Tab** - Placeholder for the upcoming cluster sizing tool with "Coming Soon" badge. Will help calculate Azure Local cluster sizing based on workload requirements.

- **Consistent Navigation Across Pages** - Both the main index.html and docs pages now share the same navigation pattern, making ODIN feel like a cohesive single-site application.

- **Session Persistence** - Active tab state is saved to session storage, so users return to their last viewed tab when navigating back.

### Changed

#### Documentation Page Updates

- **Docs Navigation Consistency** - The `/docs/outbound-connectivity/` page now includes the same top navigation bar as the main site.

- **Sidebar Repositioned** - Documentation sidebar now starts below the fixed top nav for proper layout.

- **Mobile Responsive** - Tab navigation adapts gracefully to smaller screens with condensed styling.

---

## [0.10.12] - 2026-02-03

### Added

#### Outbound Connectivity Documentation Integration

- **Outbound Connectivity Guide** - Integrated comprehensive outbound connectivity documentation into the wizard at `docs/outbound-connectivity/`. Includes detailed architecture comparisons for Public Path vs Private Path (ExpressRoute) scenarios.

- **Private Endpoints Selection Step** - New wizard step allowing users to select which Azure services will use Private Link endpoints (Key Vault, Storage, ACR, ASR, Backup, SQL MI, Defender).

- **Dynamic Connectivity Diagrams** - Configuration Report now displays the appropriate architecture diagram based on outbound path, Arc Gateway, and proxy selections (5 different scenarios supported).

- **Download SVG Buttons** - Added download buttons below connectivity diagrams in the Configuration Report for easy export.

### Changed

#### ExpressRoute Auto-Selection

- **Required Components for Private Path** - When users select "Private Path (ExpressRoute)", Arc Gateway and Proxy are now automatically enabled and marked as "Required" since both are mandatory for private connectivity.

#### Private Endpoints Configuration Report

- **Detailed PE Information** - Configuration Report now shows considerations and documentation links for each selected Private Endpoint service.

- **Proxy Bypass Examples** - Updated to use specific FQDN placeholders (e.g., `<your-keyvault-name>.vault.azure.net`) instead of wildcards for accurate proxy bypass configuration.

- **Conditional Bypass Display** - Proxy bypass information only shown when Arc Gateway OR Proxy is enabled (not shown for "No Proxy, No Arc Gateway" scenario).

#### Updated Comparison Modals

- **Outbound Connectivity Comparison** - Updated to accurately reflect Public Path (4 options) vs Private Path (ExpressRoute) with correct pros, cons, and use cases.

- **Arc Gateway Comparison** - Updated to emphasize that Arc Gateway reduces firewall rules from hundreds to fewer than 30 endpoints.

---

## [0.10.11] - 2026-01-28

### Fixed

#### Switchless Storage IPs by Adapter

- **ARM Template Alignment** - Switchless storage adapter IPs now display grouped by SMB adapter name (SMB1, SMB2, SMB3, etc.) matching the exact structure used in ARM template generation.

- **Node-to-IP Mapping** - Each adapter shows which node gets which IP address, consistent with the generated ARM parameters file.

- **Full Node Count Support** - Proper subnet-to-adapter mapping for 2-node, 3-node, and 4-node switchless configurations with correct host octet assignment (.2 for lower node, .3 for higher node).

---

## [0.10.10] - 2026-01-28

### Fixed

#### Switchless Storage Adapter IPs

- **Switchless Storage Support** - Configuration Report now displays storage adapter IPs for switchless storage configurations when Auto IP is disabled. Each subnet shows its two assigned IPs (one per connected node in the pair).

- **Both Storage Types Covered** - Storage adapter IP display now works correctly for both switched (SMB1/SMB2 per node) and switchless (per-subnet pair) configurations.

---

## [0.10.9] - 2026-01-28

### Fixed

#### Auto IP Storage Display Correction

- **Subnet-Only Display for Auto IP** - When Storage Auto IP is enabled, the Configuration Report now correctly shows only the subnet (10.71.0.0/16) instead of calculated IP addresses. This reflects the reality that Network ATC assigns IPs automatically and the actual addresses are not known until deployment.

- **Custom Subnets Unchanged** - When Storage Auto IP is disabled, the report continues to display calculated storage adapter IP addresses for each node, as these are user-defined values that will be used in the ARM template.

---

## [0.10.8] - 2026-01-28

### Fixed

#### Storage Adapter IPs for Auto IP Enabled

- **Storage Adapter IPs When Auto IP Enabled** - Configuration Report now displays default Network ATC storage adapter IP addresses when Storage Auto IP is enabled:
  - SMB1 uses 10.71.1.0/24 subnet with node IPs starting at 10.71.1.1
  - SMB2 uses 10.71.2.0/24 subnet with node IPs starting at 10.71.2.1
  - Each node is assigned sequential IPs within each subnet

- **Improved Node IP Display** - Made the node infrastructure IP display more robust with proper fallback to default node names when custom names are not set.

- **Both Auto IP Scenarios Covered** - Storage adapter IPs now display for both Auto IP enabled (default Network ATC) and Auto IP disabled (custom subnets) configurations.

---

## [0.10.7] - 2026-01-28

### Fixed

#### IP Address Display in Configuration Report (Issue #11)

- **Node Infrastructure IPs** - The Configuration Report now displays each node's name and assigned IP address in the Infrastructure Network section. This provides visibility into the exact IPs that will be used in the ARM template deployment.

- **Storage Adapter IPs** - When Storage Auto IP is disabled, the report now calculates and displays the storage adapter IP addresses for each node:
  - Shows IPs per storage subnet (e.g., SMB1 and SMB2 for switched storage)
  - Displays node name with corresponding IP address
  - IPs are calculated using the same logic as ARM template generation (subnet prefix + node index + 2)

- **ARM Template Alignment** - The Configuration Report now shows the exact IP addresses that will be populated in the ARM parameters file, helping users validate their network configuration before deployment.

---

## [0.10.6] - 2026-01-28

### Fixed

#### Storage Intent Subnet Display (Issue #9)

- **Storage Subnets in Configuration Report** - The Configuration Report now displays storage intent subnet information in the Host Networking section:
  - When Storage Auto IP is **enabled**: Shows "Default Network ATC (10.71.0.0/16)" to indicate the automatic subnet assignment
  - When Storage Auto IP is **disabled**: Displays all user-defined custom storage subnets that were configured in the wizard

- **Complete Storage Configuration Visibility** - Users can now see their complete storage network configuration in the generated report, including:
  - Switched storage: 2 storage subnets
  - Switchless 2-node: 2 storage subnets
  - Switchless 3-node: 6 storage subnets
  - Switchless 4-node: 12 storage subnets

---

## [0.10.5] - 2026-01-28

### Fixed

#### Configuration Report Security Details (Issue #7)

- **Security Configuration Details Display** - Fixed a bug where the Configuration Report only showed a summary for customized security configurations instead of displaying all the individual security settings.
  - WDAC (Windows Defender Application Control) status now displays correctly
  - Credential Guard enforcement status now displays correctly
  - Drift Control enforcement status now displays correctly
  - SMB Signing enforcement status now displays correctly
  - SMB Cluster Encryption status now displays correctly
  - BitLocker Boot Volume status now displays correctly
  - BitLocker Data Volumes status now displays correctly

- **Property Name Alignment** - Corrected mismatched property names between the wizard state object and the report generation logic:
  - `wdac` → `wdacEnforced`
  - `credentialGuard` → `credentialGuardEnforced`
  - `driftControl` → `driftControlEnforced`
  - `smbSigning` → `smbSigningEnforced`
  - `smbEncryption` → `smbClusterEncryption`
  - `bitlocker` → `bitlockerBootVolume` and `bitlockerDataVolumes`

---

## [0.10.4] - 2026-01-22

### Fixed

#### Single-Node Storage Intent Support (Issue #100)

- **Storage Intent for Single-Node Clusters** - Fixed a bug where single-node (1-node) Hyperconverged and Hyperconverged Low Capacity deployments with 4 ports could not select storage intent ports. Single-node clusters now have access to the same intent options as multi-node clusters:
  - All Traffic, Mgmt + Compute, Compute + Storage, and Custom intents are now available
  - Storage zones appear in the adapter mapping UI for all intent types
  - Single-node uses implicit "switched" storage connectivity

- **RDMA Requirements for Single-Node** - Updated RDMA port requirements:
  - **Hyperconverged (non-low-capacity)**: Requires 2 RDMA-enabled ports for storage intent (same as multi-node)
  - **Hyperconverged Low Capacity**: RDMA remains optional (no minimum requirement)
  - Default port configuration now enables RDMA for non-low-capacity single-node deployments

- **Updated Default Port Settings for Single-Node**:
  - Non-low-capacity: 10GbE with RoCEv2 RDMA enabled by default
  - Low Capacity: 10GbE with RDMA disabled by default

---

## [0.10.3] - 2026-01-20

### Added

#### Auto-Populate Storage Subnets (Issue #95)

- **Storage Subnet Auto-Population** - When Storage Auto IP is disabled (for Switched or Switchless scenarios), entering the first storage subnet now automatically populates the remaining subnet fields by incrementing the 3rd octet of the IP address:
  - Example: Entering `10.0.1.0/24` for Storage Subnet 1 will auto-fill:
    - Storage Subnet 2: `10.0.2.0/24`
    - Storage Subnet 3: `10.0.3.0/24`
    - And so on for all required subnets
  - Only empty subnet fields are auto-populated (existing values are preserved)
  - Works for all storage configurations: Switched (2 subnets), Switchless 2-node (2 subnets), 3-node (6 subnets), and 4-node (12 subnets)

---

## [0.10.2] - 2025-01-20

### Changed

#### SDN Configuration Step Redesign (Step 18)

- **SDN Enabled/Disabled Selection** - Step 18 (Software Defined Networking) now starts with a clear Yes/No selection asking whether to enable SDN:
  - **Enable SDN**: Shows the SDN feature selection cards (LNET, NSG, VNET, SLB) and management options
  - **No SDN**: Skips SDN configuration and completes the wizard without SDN features

- **Improved SDN Import Flow** - When importing ARM templates with SDN settings selected in the import dialog, the SDN enabled/disabled selection and feature checkboxes are now properly restored in the wizard.

- **Updated Validation Logic** - Step 18 validation now requires:
  1. User must select "Enable SDN" or "No SDN", AND
  2. If "Enable SDN" is selected, at least one feature and a management type must be chosen

This change provides a clearer user experience since SDN is optional and is not reflected in ARM templates.

---

## [0.10.1] - 2025-01-19

### Fixed

#### ARM Template Import Options Dialog (Issue #90)

- **ARM Import Options Dialog** - When importing an ARM template, users are now prompted with a dialog to specify settings that are not included in ARM templates:
  - **Arc Gateway**: Whether the deployment uses Arc Gateway for secure connectivity
  - **Enterprise Proxy**: Whether the deployment routes traffic through an enterprise proxy
  - **SDN Configuration**: Whether SDN is enabled, and if so, whether it's Arc-managed (with LNets/NSGs only or full VNets/SLBs) or legacy WAC-managed

This ensures that when users import a previously exported ARM template, these important deployment options are not lost and can be specified before the import completes.

---

## [0.10.0] - 2025-01-19

### Fixed

#### ARM Parameters Pre-Population (Issue #85, #86)

- **OU Path Auto-Population** - The OU Path field on the ARM Parameters page is now automatically pre-populated with the value entered during the wizard. If the OU Path was already provided, the input field is hidden since re-entry is not necessary. This eliminates redundant data entry for users. (Issue #85)

- **Cluster Name and HCI Resource Provider Object ID Loading** - When loading the ARM Parameters page, the Cluster Name and HCI Resource Provider Object ID fields are now properly pre-populated from the parameters payload. Previously, these values were not being loaded into the input fields even when they were present in the generated parameters. (Issue #86)

- **Additional Field Pre-Population** - Extended pre-population to include Tenant ID, Key Vault Name, Diagnostic Storage Account, Witness Storage Account, and Custom Location Name when these values are already present in the payload.

- **Copy JSON Now Copies Updated Parameters** - Fixed an issue where the "Copy JSON" button would copy the original JSON with placeholders instead of the updated JSON after the user fills in the input fields. Now both "Copy JSON" and "Copy Parameters & Scroll to JSON" buttons correctly copy the current (updated) parameters.

- **Storage Network VLAN ID Type Fix** - Fixed Azure ARM template validation error where `storageNetworks[].vlanId` was being output as an integer instead of a string. Azure requires this field to be a string type. This caused "Expected type string but found type integer" errors when validating the deployment in Azure Portal.

---

## [0.9.9] - 2026-01-14

### Added

#### ARM Placeholder Input Enhancement

- **Complete Placeholder Form** - Users can now input all ARM template placeholder values directly on the ARM parameters page (Section A2). The form allows filling in:
  - **Azure Context**: Tenant ID, Subscription ID, Resource Group Name, Deployment Name
  - **Cluster Configuration**: Cluster Name, Custom Location Name, Cloud Witness Storage Account, OU Path
  - **Azure Resources**: Key Vault Name, Diagnostic Storage Account, HCI Resource Provider Object ID

- **Real-time Parameter Updates** - As users enter values in the placeholder form, the parameters JSON displayed below updates instantly, replacing the REPLACE_WITH_* placeholders with actual values.

- **Update Parameters Button** - Added a prominent button to manually trigger parameter updates with visual feedback showing when parameters were last updated.

- **Conditional Field Display** - OU Path field is hidden for AD-less (Local_Identity) deployments; Cloud Witness Storage field only shows when applicable.

- **Arc Node Resource IDs Auto-Population** - The `arcNodeResourceIds` parameter now automatically uses:
  - Actual node names from the wizard's Node Settings (Step 11)
  - Subscription ID and Resource Group from the Azure Context inputs
  - No manual input required - values are populated automatically when the user enters subscription and resource group

---

## [0.9.8] - 2026-01-14

### Fixed

#### Required Badge Styling (Issue #76)

- **Badge-Style Labels** - Changed the "Required" indicators for Cloud Witness and Storage Switched options (in Rack Aware scenarios) to use the same badge styling as "Recommended" badges. The labels now appear as blue pill-shaped badges in the top-right corner of the option cards, matching the UI consistency of other badges.

---

## [0.9.7] - 2026-01-14

### Added

#### Deploy to Azure UX Enhancement

- **Step-by-Step Instructions** - Added a detailed instruction box in the Deploy to Azure section (Step A3) explaining how to copy and paste parameters to Azure Portal:
  1. Click "Deploy to Azure" to open Azure Portal with the ARM template
  2. Use the new "Copy Parameters & Scroll to JSON" button
  3. In Azure Portal, click "Edit parameters"
  4. Paste the copied JSON and save
  5. Replace any remaining REPLACE_WITH_ placeholders

- **Copy Parameters Button** - Added a convenient "Copy Parameters & Scroll to JSON" button that:
  - Copies the entire parameters JSON to clipboard
  - Scrolls the page to the JSON section
  - Highlights the JSON viewer to confirm the copy
  - Shows visual feedback on successful copy

- **Updated Confirmation Dialog** - The Deploy to Azure confirmation now includes numbered steps for the copy/paste workflow

---

## [0.9.6] - 2026-01-14

### Fixed

#### Deploy to Azure Button (Issue #73)

- **Clarified Deploy to Azure Behavior** - The Azure Portal's template deployment blade does NOT support pre-filling parameters via URL. Updated the Deploy to Azure functionality to:
  - Remove the non-working `/~/` parameter passing that was added in v0.9.3
  - Update the confirmation dialog to clearly instruct users to copy parameter values from the ARM Parameters section (Step A5)
  - Provide clearer instructions about manually entering values in the Azure Portal

#### Template Import Default (Issue #74)

- **Fixed Default Scale on ARM Import** - When importing an ARM template, the wizard now defaults to **Hyperconverged** (medium) instead of Low Capacity, regardless of node count. Users who want Low Capacity must explicitly select it after import.

---

## [0.9.5] - 2026-01-14

### Added

#### Azure Region Ordering (Issue #70)

- **Alphabetized Commercial Regions** - Azure commercial regions are now displayed in alphabetical order for easier navigation:
  - Australia East, Canada Central, East US, India Central, Japan East, South Central US, Southeast Asia, West Europe
  - US Gov Virginia remains at the end as a government cloud option

#### Documentation Links (Issue #69)

- **Low Capacity Info Link** - Added "Learn more" link to the Hyperconverged Low Capacity option pointing to system requirements documentation
- **Rack Aware Info Link** - Added "Learn more" link to the Rack Aware option pointing to rack-aware cluster overview documentation

#### Knowledge Links (Issue #71)

- **Cloud Witness Knowledge Link** - Added info icon (ℹ️) to Cloud Witness step header linking to quorum witness deployment documentation
- **Network Traffic Intents Knowledge Link** - Added info icon (ℹ️) to Network Traffic Intents step header linking to network considerations documentation

---

## [0.9.4] - 2026-01-14

### Fixed

#### Adapter Mapping Configuration (Issue #67)

- **Fixed Custom Adapter Mapping in ARM Output** - When users customize the adapter mapping (e.g., assigning Ports 2 and 4 to Storage instead of the default Ports 3 and 4), the ARM parameters output now correctly reflects the user's selection:
  - Storage intent adapters now use the actual port numbers (e.g., `SMB2`, `SMB4`) instead of always defaulting to `SMB3`, `SMB4`
  - Management + Compute intent adapters now correctly map to user-selected ports (e.g., `NIC1`, `NIC3`)
- **Fixed Diagram Labels** - The network topology diagram now displays adapter labels matching the confirmed adapter mapping
- **Consistent Behavior Across All Intent Types** - The fix applies to all intent types (`mgmt_compute`, `compute_storage`, `all_traffic`, `custom`) when adapter mapping is confirmed

---

## [0.9.3] - 2026-01-13

### Fixed

#### DNS Server Display (Issue #64)

- **Fixed DNS Server Display After Import** - DNS servers now properly render in the UI after:
  - ARM template import (dnsServers array parsed from ARM parameters)
  - Odin configuration file import
  - Session resume from localStorage
- **Root Cause**: The `renderDnsServers()` function was not being called after `updateUI()` in import/resume handlers, leaving the DNS servers container empty even though `state.dnsServers` was populated

#### Deploy to Azure Enhancement (Issue #65)

- **Pre-filled Parameters in Azure Portal** - The "Deploy to Azure" button now passes configured parameters directly to the Azure Portal URL:
  - `domainFqdn` - Active Directory domain FQDN
  - `adouPath` - Active Directory OU path
  - `dnsServers` - DNS server IP addresses
  - `arcNodeResourceIds` - Arc node resource IDs (if not placeholders)
  - `location` - Azure region
  - `witnessType` - Cluster witness type
  - `networkingPattern` - Network intent pattern
  - `subnetMask`, `startingIPAddress`, `endingIPAddress`, `defaultGateway` - IP configuration
  - `securityLevel`, `configurationMode` - Security and storage settings
- **Improved User Experience**: Users no longer need to manually copy/paste all parameters - key values are automatically pre-filled when redirected to Azure Portal

---

## [0.9.2] - 2026-01-13

### Fixed

#### Template Loading Fixes (Issue #59)

- **Fixed Template Loading Order** - Corrected the order of `selectOption` calls when loading templates so that storage is set before ports, preventing ports from being reset
- **Fixed Missing Sections Navigation** - Updated the `missingSectionToStep` mapping so clicking on missing sections (like "Ports") correctly scrolls to the right step:
  - Ports now correctly links to step-5 (Network Adapter Ports)
  - Azure Cloud links to step-cloud
  - Azure Local Instance Region links to step-local-region  
  - Scale links to step-2
  - Nodes links to step-3
  - Storage Connectivity links to step-4
  - Traffic Intent links to step-6
  - Outbound Connectivity links to step-7
  - Arc Gateway links to step-8
  - Proxy links to step-9

---

## [0.9.1] - 2026-01-13

### Changed

#### UI Improvements

- **Page Statistics Repositioned** - Moved the Page Statistics box (Page Views, Designs Generated, ARM Deployments) from above the disclaimer to below the header description paragraph for better visual flow
- **Renamed Statistics Label** - Changed "Documents Generated" to "Designs Generated" for clarity
- **Reduced Header Spacing** - Tightened the spacing below the header section from 4rem to 2.5rem for a more compact layout

---

## [0.9.0] - 2026-01-13

### Added

#### Missing Sections Display (Issue #55)

- **Dynamic Missing Sections Display** - Added a prominent red-bordered container above the Generate buttons that shows which configuration sections are incomplete:
  - Displays clickable anchor links for each missing section
  - Updates dynamically as users complete fields
  - Provides instant visibility into what's needed before generating outputs

- **Navigation to Missing Sections** - Clicking on any missing section link:
  - Smoothly scrolls to the relevant wizard step
  - Highlights the target step with a brief animation
  - Works with partial matches for flexible navigation

- **Complete Example Templates** - Fixed all 5 example templates to be 100% complete with all required fields:
  - **Small AD-Joined Cluster**: 2-node, switchless, Azure AD with full network config
  - **Medium Switched Cluster**: 4-node, switched storage, compute+storage intent
  - **Large Enterprise Cluster**: 8-node, switched, all traffic intent, full security
  - **Single Node (Dev/Test)**: 1-node, local identity, minimal configuration
  - **Rack-Aware Multi-Rack**: 4-node across 2 fault domains, full rack-aware settings

#### Import ARM Templates from Azure Portal (Issue #56)

- **ARM Template Import** - Extended the Import Configuration feature to accept Azure ARM templates exported from the Azure Portal:
  - Auto-detects ARM templates by checking the `$schema` property
  - Supports both ARM template files and parameters files
  - Shows informative toast message when ARM format is detected

- **Comprehensive Parameter Mapping** - Maps ARM template parameters to Odin wizard state:
  - `physicalNodesSettings` → Node names and IP addresses
  - `domainFqdn` → Active Directory domain
  - `dnsServers` → DNS server configuration
  - `subnetMask`, `startingIPAddress`, `endingIPAddress` → Network ranges
  - `networkingType` → Storage switched/switchless
  - `networkingPattern` → Traffic intent configuration
  - Security settings: driftControl, credentialGuard, SMB signing, BitLocker, WDAC

- **Graceful Import** - After importing an ARM template:
  - Prompts user to review and complete any missing fields
  - Preserves existing Odin export/import functionality
  - Provides clear error messages for invalid files

---

## [0.8.2] - 2025-12-19

### Fixed

#### Bug Fixes

- **Custom Storage Subnets in Diagrams (Issue #50)** - Fixed the switchless storage diagram legends to display custom storage subnet CIDRs when Storage Auto IP is disabled:
  - Legend now shows actual custom subnet values instead of conceptual/example CIDRs
  - Legend title changes from "Storage subnets (conceptual)" to "Storage subnets (custom)" when using custom subnets
  - Applied to all switchless diagram variants (2-node, 3-node single-link, 3-node dual-link, 4-node)

- **RDMA Hardware Requirement Tooltip** - Clarified that the RDMA port requirement applies to multi-node clusters, not single-node deployments

- **Code Cleanup** - Simplified redundant null/undefined checks per Copilot review

### Added

- **MLAG Peer Links in Diagram** - Added visual representation of MLAG connectivity between ToR switches in the Storage Switched diagram when dual ToR configuration is used

---

## [0.8.1] - 2025-12-19

### Fixed

#### Bug Fixes (Issue #48)

- **Compare Options Popup** - Fixed styling issues with the Compare Options modal:
  - Added `max-height: 90vh` with scrolling support so content fits within the viewport
  - Made the close button (X) visible with proper styling and hover effect
  - Added sticky header so title and close button remain visible while scrolling

- **ToR Switch Logic** - Fixed the conditional logic for Single/Dual ToR switch availability:
  - Hyperconverged clusters with 1-3 nodes can now correctly choose Single or Dual ToR
  - Hyperconverged clusters with 4+ nodes correctly restrict to Dual ToR only (Single is greyed out)
  - Fixed incorrect scale value check (was using wrong value for Hyperconverged detection)

---

## [0.8.0] - 2025-12-19

### Added

#### ToR Switch Selection (Issue #47)

- **ToR Switch Options** - Added "Single ToR Switch" and "Dual ToR Switches" selection options for Storage Switched scenarios with Hyperconverged or Low Capacity clusters:
  - **Hyperconverged (4+ nodes)**: Only Dual ToR is available (Single ToR is disabled)
  - **Hyperconverged (1-3 nodes)**: Both Single and Dual ToR options available, defaulting to Dual
  - **Low Capacity**: Both Single and Dual ToR options available

- **Improved Storage Switched Diagram** - Completely redesigned the network diagram for Storage Switched scenarios:
  - **ToR Switch Visualization**: Shows ToR switches at the top of the diagram (1 or 2 based on selection)
  - **Horizontal Adapter Layout**: All network adapters are now displayed horizontally within each node box for better visual clarity
  - **Uplink Connections**: Dashed lines show the uplink paths from adapters to ToR switches (odd NICs to ToR 1, even NICs to ToR 2 for dual configurations)
  - **Simplified View**: Shows maximum 2 nodes regardless of cluster size, with a badge indicating additional nodes

### Changed

- **Storage Connectivity Labels** - Renamed storage connectivity options from "Switched"/"Switchless" to "Storage Switched"/"Storage Switchless" for clarity

---

## [0.7.0] - 2025-12-19

### Added

#### Deploy to Azure Button (Issue #45)

- **One-Click Azure Deployment** - Added a prominent "Deploy to Azure" button on the ARM Parameters page that redirects users to the Azure Portal with the appropriate ARM template pre-loaded based on their configuration:
  - Commercial Azure deployments use `portal.azure.com`
  - Azure Government deployments use `portal.azure.us`

- **Template Auto-Selection** - The button automatically selects the correct ARM quickstart template based on the scenario configured in the wizard (standard cluster, rack-aware, AD-less, US Gov, etc.).

- **Collapsible Template Reference** - The list of all available ARM templates is now in a collapsible section to reduce clutter and highlight the Deploy button.

#### Node Name Auto-Population

- **Smart Node Naming** - When entering a name in the "Node 1 Name" field with a numeric suffix (e.g., `server01` or `customname1`), the remaining node name fields are automatically populated with sequential names:
  - `server01` → `server02`, `server03`, `server04`...
  - `node5` → `node6`, `node7`, `node8`...
  - `myhost` → `myhost2`, `myhost3`, `myhost4`...

- **Padding Preservation** - Number padding is preserved (e.g., `host001` → `host002`, `host003`).

- **SAM Account Name Validation** - Validates the maximum 15-character limit for Active Directory computer account names (SAM Account name).

- **Non-Destructive** - Only fills empty node name fields; never overwrites user-provided values.

#### DCB QoS Overrides for Storage Intents (Issue #44)

- **QoS Policy Customization** - Added new override options in the Network Traffic Intents section for storage intents that allow customization of Data Center Bridging (DCB) QoS policies:
  - **Storage Priority**: Choose between priority 3 (default) or 4 for SMB traffic
  - **System/Cluster Priority**: Choose between priority 5 (default), 6, or 7 for cluster heartbeat traffic
  - **Bandwidth Reservation**: Set the percentage of bandwidth reserved for storage traffic (40-70%, default 50%)

- **ARM Template Support** - When QoS overrides are configured, the ARM template includes `overrideQosPolicy: true` and a `qosPolicyOverrides` object with the custom settings.

#### Proxy Bypass String Generation (Issue #43)

- **Automatic Bypass String** - When proxy is enabled in the cluster configuration, the report now displays a ready-to-use proxy bypass string that includes:
  - `localhost` and `127.0.0.1`
  - All cluster node hostnames
  - All cluster node IP addresses
  - Domain wildcard (e.g., `*.contoso.local`)
  - Infrastructure subnet wildcard (e.g., `192.168.1.*` for 192.168.1.0/24)

- **CIDR to Wildcard Conversion** - Added helper function to convert CIDR notation to proxy bypass wildcard format.

#### Custom Storage Subnets (Issue #42)

- **Custom Subnet Input** - When Storage Auto IP is disabled, users can now specify custom storage subnet CIDRs instead of using the default 10.0.x.0/24 networks. The number of subnets required depends on the storage configuration:
  - 2-node switchless: 2 subnets
  - 3-node switchless: 6 subnets
  - 4-node switchless: 12 subnets
  - Switched storage with Auto IP disabled: 2 subnets

- **Dynamic UI** - Subnet input fields are automatically shown/hidden based on storage configuration and Auto IP setting.

- **ARM Template Integration** - Custom subnets are applied to the `storageNetworkList` in the ARM template with proper IP address and subnet mask calculations.

---

## [0.6.2] - 2025-12-18

### Fixed

#### iOS Mobile Layout Fixes

- **Fixed Configuration Summary Blocking Page** - The Configuration Summary panel was blocking the entire page on iOS and mobile devices due to the fixed 460px width sidebar. Added `!important` CSS overrides to force proper column stacking on mobile.

- **Fixed Header Logo Overlapping Title** - Replaced inline styles in header HTML with proper CSS classes (`.header-title-wrapper`, `.header-logo-wrapper`) that can be properly overridden by media queries. On mobile, the logo now displays above the title instead of overlapping it.

- **Improved Mobile Layout Reliability** - Added stronger CSS specificity with `!important` rules for mobile layout to ensure proper rendering on iOS Safari:
  - `.layout-flex` forces `flex-direction: column`
  - `.steps-column` and `.summary-column` force `width: 100%` and proper ordering
  - `#summary-panel` forces `position: relative` to prevent sticky floating behavior

---

## [0.6.1] - 2025-12-18

### Added

#### Mobile Browser Support (Issue #38)

- **Comprehensive Mobile Responsive Design** - Added full responsive CSS support for mobile and tablet devices:
  - Tablet breakpoint (1024px): Adjusted container padding and preview grid
  - Mobile breakpoint (768px): Reorganized header, breadcrumbs, wizard progress, steps, and modals for mobile screens
  - Small mobile breakpoint (480px): Further optimized compact layouts for very small screens
  - Touch device improvements: Larger touch targets, removed hover effects, added active states

- **Mobile-Optimized Components**:
  - Header and logo scale appropriately on smaller screens
  - Breadcrumb navigation becomes scrollable with compact styling
  - Option cards and step containers adapt to single-column layouts
  - Preview modal becomes full-screen on mobile for better usability
  - Onboarding tutorial optimized for mobile with stacked buttons
  - Report action buttons stack vertically on narrow screens
  - Input fields use 16px font size to prevent iOS zoom on focus
  - Keyboard shortcuts help hidden on mobile (touch devices)

---

## [0.6.0] - 2025-12-18

### Added

#### Visual Feedback Improvements

- **Selected Option Checkmarks** - Option cards now display a blue checkmark (✓) in the top-right corner when selected, providing clear visual feedback of the current selection.

- **Checkmark Animation** - Smooth pop-in animation when checkmarks appear for a polished user experience.

### Changed

#### UI/UX Improvements

- **Renamed Action Buttons** - Export buttons renamed for clarity:
  - "Generate Report" → "📋 Generate Cluster Design Document"
  - "Generate ARM" → "🚀 Generate Cluster ARM Deployment Files"

- **Removed PDF Export** - Removed the PDF export button as it was not providing value.

- **8 Ports Tooltip** - Updated tooltip from "Maximum Density" to "Maximum resiliency and performance" for accuracy.

### Fixed

#### Step Indicator Validation

- **Step Indicators** - Fixed all 19 step indicators to correctly show completion status with proper validation logic.

- **Network Traffic Intents (Step 6)** - Fixed validation to check actual intent state and custom intent confirmation.

- **Management Connectivity (Step 10)** - Fixed validation to require all node IPs when static IP is selected.

- **Infrastructure Network (Step 12)** - Fixed validation to require all fields (CIDR, start IP, end IP, gateway).

- **Active Directory (Step 13)** - Fixed validation to require all mandatory fields based on selected AD option.

#### Stability Improvements

- **Import Configuration Stability** - Fixed browser crash when importing configuration files. Added asynchronous processing, error handling, and loading feedback to prevent UI blocking.

---

## [0.5.4] - 2025-12-18

### Fixed

#### Code Quality Improvements (Copilot Review PR #24)

- **Keyboard Shortcuts Input Detection** - Keyboard shortcuts now check if the user is typing in an input field, textarea, or select element before triggering. Only the Escape key works while typing to allow closing modals.

- **Start Over Confirmation Dialog** - The Alt+S (Start Over) keyboard shortcut now shows a confirmation dialog before resetting all configuration, preventing accidental data loss.

- **Removed Inline Event Handlers** - Replaced inline `onclick` attributes with `addEventListener` in the shortcuts help modal and onboarding tutorial for better separation of concerns and maintainability.

---

## [0.5.3] - 2025-12-18

### Fixed

#### Bug Fixes

- **Issue #23: Multi-Rack Message Visibility** - Fixed issue where the Multi-Rack option note remained visible after changing to another scenario option. The message now properly hides when switching scenarios.

- **Issue #33: Multi-Rack Note with M365 Local** - Fixed issue where the Multi-Rack note remained visible when switching to M365 Local deployment type. The M365 Local handler now explicitly hides the Multi-Rack message.

- **Issue #25: RDMA Dropdown Auto-Disable** - The RDMA dropdown in Intent Overrides (Step 08) now automatically sets to "Disabled" and becomes non-interactive when the NICs in that intent group do not have RDMA enabled in Step 07 Port Configuration.

- **Issue #28: Low Capacity RDMA Enforcement** - For Low Capacity scenarios with Switched storage connectivity, the wizard no longer enforces RDMA ports for storage intent in custom intent mappings. This aligns with the existing behavior where Low Capacity deployments are exempt from minimum RDMA port requirements.

---

## [0.5.2] - 2025-12-18

### Changed

#### Logo and Header Improvements

- **Updated Logo** - New Odin logo with improved design and proper aspect ratio
- **Theme-Aware Logo** - Logo automatically switches between dark and light variants when toggling theme
  - Dark theme: `odin-logo.png`
  - Light theme: `odin-logo-white-background.png`
- **Improved Header Layout** - Restructured header for better visual balance
  - Title now centered independently
  - Logo positioned on the right with version info below
  - Description text with constrained width for better readability
- **Updated Disclaimer** - Revised disclaimer text for clarity
- **Centered Disclaimer Box** - Disclaimer now centered with fit-content width

---

## [0.5.1] - 2025-06-12

### Added

#### Drag & Drop Adapter Mapping

- **Interactive Adapter Mapping UI** - New visual drag-and-drop interface for assigning network adapters to traffic intents
  - Drag adapters between pool and intent zones
  - Click-to-select fallback for accessibility
  - RDMA status shown on adapter pills
  - Real-time validation of assignments

- **Scale-Aware Minimum Adapter Requirements** - Validation rules adapt to deployment scale
  - Standard deployments: Minimum 2 adapters per intent
  - Low Capacity deployments: Minimum 1 adapter per intent
  - RDMA requirement checking for storage intents

- **Intent Zone Cards** - Visual cards for each traffic intent zone
  - Color-coded headers (Management=Blue, Compute=Green, Storage=Purple)
  - Badge indicators for requirements (Required, Optional, RDMA Required)
  - Visual completion state (green border when requirements met)
  - Error state highlighting for RDMA issues

- **Confirm Overrides Button** - Lock mechanism for intent overrides
  - Prevents accidental changes after configuration
  - Edit mode toggle for adjustments
  - Status indicator showing confirmation state

### Changed

- **Intent Override Gate** - Overrides section now gates on adapter mapping confirmation
  - Custom intent flow requires adapter mapping to be confirmed before showing overrides
  - Provides clearer progression through configuration

### Fixed

- **State Reset Consistency** - Adapter mapping state properly resets when changing:
  - Scenario selection
  - Region selection
  - Scale selection
  - Node count selection
  - Port count selection
  - Intent type selection

---

## [0.5.0] - 2025-12-17

### Added

#### Professional UX Enhancements

- **Configuration Preview Modal** - New preview button shows complete configuration summary before generating outputs
  - Organized sections: Deployment, Cluster, Network, Identity & Security
  - Visual status indicator for completion state
  - Direct "Generate Report" action from preview
  - Shows missing configuration items with count

- **Breadcrumb Step Navigation** - Clickable step indicators for quick navigation
  - 8-step progress indicator at top of page
  - Visual completion checkmarks (✓) for finished steps
  - Click to jump directly to any step
  - Sticky positioning for always-visible access

- **Keyboard Shortcuts** - Power-user shortcuts for common actions
  - `Alt+P` - Preview Cluster Configuration
  - `Alt+R` - Generate Report
  - `Alt+E` - Export Configuration
  - `Alt+I` - Import Configuration
  - `Alt+S` - Start Over
  - `Alt+1-8` - Navigate to steps 1-8
  - `Esc` - Close modals
  - `Alt+?` - Show shortcuts help

- **PDF Export** - Export configuration summary as printable PDF
  - Professional layout optimized for printing
  - Includes all configuration sections
  - Shows completion status and missing items
  - Browser print dialog for save as PDF

- **Onboarding Tutorial** - First-time user walkthrough
  - 3-step interactive introduction
  - Feature highlights with icons
  - Progress dots indicator
  - Skip option for returning users
  - Stored preference in localStorage

- **Animated Step Transitions** - Smooth visual feedback
  - Fade-in animation for steps
  - Scale-in for modals
  - Smooth scroll for navigation

### Changed

- **Step Visibility** - Steps now use CSS animations when appearing/hiding
- **Modal Design** - Consistent modal styling across all overlays
- **Button Styling** - New preview button with gradient background

### Technical

- **CSS Additions** - 300+ lines of new styles for:
  - Breadcrumb navigation components
  - Preview modal layout
  - Onboarding overlay cards
  - Keyboard shortcuts display
  - Animation keyframes
- **JavaScript Functions** - New functions added:
  - `navigateToStep()` - Scroll to and highlight step
  - `updateBreadcrumbs()` - Update breadcrumb state
  - `initKeyboardShortcuts()` - Register keyboard handlers
  - `showShortcutsHelp()` - Display shortcuts modal
  - `showConfigurationPreview()` - Render preview modal
  - `exportToPDF()` - Generate print-friendly HTML
  - `showOnboarding()` - Display tutorial overlay
  - `renderOnboardingStep()` - Render tutorial step

---

## [0.4.3] - 2025-06-26

### Fixed

#### Issue #19 - Update Step 04 Cluster Configuration Option Names

- **Renamed Scale Options** - Updated Step 04 option names for clarity:
  - "Low Capacity" → "Hyperconverged Low Capacity"
  - "Standard" → "Hyperconverged"
  - "Rack Aware" → "Hyperconverged Rack Aware"

#### Issue #20 - AD-Less Option Incorrectly Enabled on Page Load

- **Fixed Initial State** - Added `updateUI()` call on DOMContentLoaded to ensure AD cards are properly disabled until infrastructure IP range is configured in Step 15

#### Issue #21 - M365 Local Warning Persists After Selecting Another Option

- **Fixed Message Hiding** - Added code in `selectOption()` to hide the M365 Local documentation message when user selects a different scenario option

---

## [0.4.2] - 2025-12-17

### Added

#### Issue #11 - Odin Branding on Output Pages
- **Report Page Branding** - Added "Odin for Azure Local" branding to report.html header
- **ARM Parameters Branding** - Added "Odin for Azure Local" branding to arm.html header

#### Issue #13 - Print Friendly Option
- **Print Friendly Toggle** - Added "Print Friendly" button to report.html
- **CSS Class Toggle** - Uses CSS class `print-friendly-mode` for robust style switching
- **White Background Mode** - Optimizes report for printing with white backgrounds and black text

#### Issue #14 - Export Filename Prompt
- **Custom Filename Support** - Export configuration now prompts for custom filename
- **Filename Sanitization** - Uses `sanitizeInput()` to prevent unsafe characters
- **User Confirmation** - Shows confirmation dialog if filename was adjusted during sanitization

#### Issue #15 - ARM Parameters Improvements
- **Tenant ID Field** - Added optional Tenant ID input field with GUID validation
- **GUID Pattern Validation** - Validates Tenant ID format (00000000-0000-0000-0000-000000000000)
- **ARM Template Reference Links** - Added links to Azure Quickstart Templates for reference
- **Renamed Identity Options** - Changed labels to "Active Directory Domain Services (AD) for Identity" and "Azure KeyVault for Identity (AD-Less)"

#### Issue #17 - Example Configuration Templates
- **Renamed Button & Modal** - Changed "Load Configuration Template" to "Load Example Configuration Template"
- **Complete Configurations** - All 5 templates now include ALL required wizard settings

### Fixed

#### Issue #12 - Session Restore for SDN Settings
- **SDN Features Restore** - Fixed session restore to properly cache and restore SDN feature checkboxes
- **SDN Management Restore** - SDN management selection is now properly restored from saved state

#### Copilot Code Review Fixes
- **Print Friendly Button Selector** - Added unique ID `print-friendly-btn` for unambiguous selection
- **Print Friendly Style Toggle** - Refactored to use CSS classes instead of inline styles for proper computed style handling
- **Filename Sanitization** - Added user confirmation when filename is modified during sanitization
- **PowerShell Comment Formatting** - Moved Tenant ID explanation to separate line above variable
- **Bash Comment Formatting** - Moved Tenant ID explanation to separate line above variable
- **Tenant ID Validation** - Added GUID pattern validation with visual error feedback

### Changed
- **Template Descriptions** - Updated to be more informative about use cases
- **Deployment Scripts** - Tenant ID is now included with proper comment formatting

### Improved
- **Template Loading** - `loadTemplate()` function handles all configuration properties in logical step order
- **Modal Description** - Updated to indicate templates include all required settings

---

## [0.4.1] - 2025-12-17

### Added
- **Disclaimer Notice** - Added disclaimer informing users that this tool is provided as-is without Microsoft support and is an experimental project to help customers accelerate their Azure Local skills ramp up while helping IT architects validate desired configurations

### Changed
- **Updated Description** - Removed reference to ARM template deployment from the main description text

### Fixed
- **Report Page Title** - Corrected the title on the report page to use "Odin for Azure Local"

---

## [0.4.0] - 2025-12-16

### Added

#### ARM Parameters Page - Deployment Automation
- **Deployment Script Generation** - Generate ready-to-use deployment scripts
  - **PowerShell Deployment Script** - Complete PS1 script with Azure authentication and ARM template deployment
  - **Azure CLI Command Preview** - Bash script with az CLI commands for deployment
  - **Bicep/Terraform Alternatives** - Modal showing IaC conversion options with documentation links
  - **Script Download** - One-click download of generated scripts

- **Parameter Input Fields with Auto-Update** - Editable fields that update parameters in real-time
  - **Subscription ID Field** - Input field for Azure subscription ID
  - **Resource Group Name Field** - Input field for target resource group
  - **Deployment Name Field** - Input field for deployment name
  - **Live JSON Updates** - Parameters JSON updates automatically as fields are populated
  - **Placeholder Replacement** - Automatically replaces REPLACE_WITH_* placeholders

- **Enhanced User Experience**
  - **Validation Notifications** - Shows error messages if required fields are missing
  - **Success Feedback** - Confirmation notifications when scripts are downloaded
  - **Input Guidance** - Helper text showing how to use parameter fields
  - **Section Reorganization** - Clearer section numbering (A1-A6) for better navigation

### Changed
- **ARM Page Section Numbers** - Updated to accommodate new deployment features:
  - A1: Metadata
  - A2: Placeholders (now with input fields)
  - A3: Deployment Script Generation (new)
  - A4: Parameters File Content → A5: Parameters File JSON
  - A5: Integration Features → A6: Integration Features

---

## [0.3.0] - 2025-12-16

### Added

#### User Experience Enhancements
- **Font Size Controls** - Adjust text size for better readability
  - **Increase/Decrease Buttons** - A+ and A- buttons in summary panel
  - **Four Size Options** - Small, Medium, Large, and X-Large
  - **Persistent Preference** - Font size saved to localStorage across sessions
  - **Instant Application** - Changes apply immediately to entire interface

- **Dark/Light Theme Toggle** - Switch between dark and light themes
  - **Theme Button** - Moon/sun icon toggle in summary panel
  - **Complete Theme Support** - All UI elements adapt to selected theme
  - **Persistent Preference** - Theme choice saved across sessions
  - **Smooth Transitions** - Animated theme switching

- **Step Progress Indicators** - Visual feedback on completed steps
  - **Checkmark Indicators** - Green checkmarks appear on completed steps
  - **Real-time Updates** - Indicators update as configuration progresses
  - **Clear Visual Progress** - Easy to see which steps are complete

- **Configuration Templates** - Pre-built templates for common scenarios
  - **5 Ready-to-Use Templates** - Common deployment configurations
    - 2-Node Standard Cluster (small production with cloud witness)
    - 4-Node High Performance (medium cluster with dedicated storage)
    - 8-Node Rack Aware (large rack-aware production cluster)
    - Disconnected 2-Node (air-gapped with Active Directory)
    - Edge 2-Node Switchless (cost-optimized edge deployment)
  - **One-Click Loading** - Apply complete configurations instantly
  - **Template Browser** - Modal dialog with template descriptions and tags
  - **Success Notifications** - Confirmation when template loads

#### Documentation Links
- **Firewall Requirements Link** - Added to Outbound Connectivity section
  - **Direct Documentation** - Links to Microsoft Learn firewall requirements
  - **Required Endpoints Info** - Details on firewall rules and endpoints
  - **Lock Icon** - Visual indicator for security-related documentation

- **M365 Local Documentation Redirect** - Special handling for M365 Local deployment type
  - **Workflow Stop** - Selecting M365 Local stops the wizard flow
  - **Documentation Modal** - Displays informational message with link to M365 Local overview
  - **Direct Link** - Takes users to Microsoft Learn M365 Local on Azure Local documentation
  - **Clean Exit** - Users can close modal and select different deployment type

#### ARM Parameters Integration Features
- **Azure DevOps Pipeline Template** - Generate ready-to-use Azure DevOps YAML pipeline
  - **Validation Stage** - Automatic ARM template validation before deployment
  - **Deployment Stage** - Automated deployment with environment approval gates
  - **Download as File** - Export as azure-pipelines.yml

- **GitHub Actions Workflow** - Export GitHub Actions workflow for CI/CD
  - **Multi-Environment Support** - Separate validation and deployment jobs
  - **Secrets Integration** - Uses GitHub secrets for Azure credentials
  - **Deployment Summary** - Automatic summary in GitHub Actions output
  - **Download as File** - Export as deploy.yml for .github/workflows

- **REST API Documentation** - Information modal for automation capabilities
  - **API Endpoint Details** - Example POST endpoint for parameter generation
  - **Request Examples** - Sample JSON payload for configuration
  - **Feature Overview** - Batch processing, validation, webhook integration
  - **Future Availability** - Planned for future release

### Changed
- **Summary Panel Layout** - Reorganized controls into two rows for better organization
- **Font and Theme Controls** - Grouped together below auto-scroll toggle
- **Tool Rebranding** - Renamed to "Odin for Azure Local"
  - **Norse Mythology** - Named after Odin, the Norse god embodying strategic thinking and wisdom
  - **Acronym** - ODIN: **O**ptimal **D**eployment and **I**nfrastructure **N**avigator
  - **Updated Description** - Enhanced to reflect the tool's purpose as a strategic guide for Azure Local deployments

### Fixed
- **Rack Aware Identity Restriction** - Local Identity option is now disabled for Rack Aware deployments (only Active Directory is supported)

---

## [0.2.1] - 2025-12-15

### Added

#### Active Directory OU Path
- **AD OU Path Field** - New optional field in Active Directory step (Step 16)
  - **Appears with Active Directory** - Shown when "Azure Local with Active Directory" is selected
  - **Format Validation** - Validates OU path syntax (e.g., OU=Cluster1,OU=AzureLocal,DC=contoso,DC=com)
  - **Helpful Tooltip** - Info icon with example and explanation
  - **AD Preparation Tool Link** - Direct link to Microsoft documentation for AD preparation
  - **ARM Template Integration** - Maps to `adouPath` parameter in deployment template
  - **Report Integration** - Displays in Active Directory section of generated report
  - **Real-time Validation** - Immediate feedback if format is invalid

---

## [0.2.0] - 2025-12-15

### Added

#### Auto-Scroll Feature
- **Auto-Scroll Toggle** - New toggle control below Progress bar to enable/disable automatic scrolling
  - **Default Enabled** - Auto-scroll is on by default for smooth wizard flow
  - **1 Second Delay** - Pauses 1 second before scrolling to allow review of selection
  - **Persistent Preference** - Toggle state saved to localStorage across sessions
  - **Smart Scrolling** - Port selection scrolls directly to Port Configuration section instead of next step
- **Improved User Flow** - Automatically advances to next step after making a selection
- **Enhanced Navigation** - Guides users through the wizard naturally without manual scrolling

#### Cloud Witness Type
- **Cloud Witness Type Section** - New step after node count selection (Step 05.5)
  - **Automatic Configuration** - Witness type automatically determined based on cluster configuration
  - **Cloud Witness** - Azure cloud witness for high availability (required for Rack Aware and 2-node clusters)
  - **No Witness** - No witness configuration (default for 3+ node Standard/Low Capacity clusters)
- **Conditional Logic** - Witness type locked based on cluster configuration:
  - Rack Aware clusters → Cloud witness (required)
  - 2-node Standard/Medium clusters → Cloud witness (required)
  - 2-node Low Capacity clusters → Cloud witness (required)
  - All other node counts → No witness (default)
- **ARM Template Integration** - Maps to `witnessType` parameter in deployment template
- **Validation & Progress Tracking** - Witness type included in validation checks and progress tracking
- **Summary Report** - Witness type displayed in configuration summary
- **Visual Feedback** - Disabled cards with tooltips when locked, info box explains requirements

#### Storage Pool Configuration
- **Storage Pool Configuration Section** - Repositioned to Step 15 (after Infrastructure Network, before Active Directory)
  - **Express Mode** - Quick deployment with standard settings (default)
  - **Infra Only** - Infrastructure-only deployment without storage pool
  - **Keep Storage** - Preserve existing storage configuration
- **ARM Template Integration** - Maps to `configurationMode` parameter in deployment template

#### Security Configuration
- **Security Configuration Section** - Step 17 (after Active Directory)
  - **Recommended Option** - Secure by default configuration with all security controls enabled
  - **Customized Option** - Granular control over individual security settings
- **Custom Security Controls** - Toggle switches for 7 security settings:
  - Drift Control Enforced
  - Bitlocker Boot Volume
  - Bitlocker Data Volumes
  - WDAC Enforced
  - Credential Guard Enforced
  - SMB Signing Enforced
  - SMB Cluster Encryption
- **ARM Template Integration** - Security settings automatically map to ARM template parameters
  - `securityLevel` parameter set to "Recommended" or "Customized"
  - Individual security control parameters (camelCase, no spaces)
- **Validation & Progress Tracking** - Security configuration included in validation checks and progress tracking
- **Summary Report** - Security settings displayed in configuration summary with detailed breakdown when customized
- **Toggle Switch UI** - Custom-styled toggle switches with smooth animations and visual feedback

### Changed
- **Page Description** - Updated introductory text to better describe ALDA tool capabilities
- **Default Port Speed** - Changed default network adapter speed to 25GbE for all cluster scales (previously 1GbE for Low Capacity, 10GbE for Standard, 25GbE for Rack Aware)
- **Step Numbering** - Updated step numbers due to Storage Pool Configuration repositioning:
  - Storage Pool Configuration: Step 07.5 → Step 15
  - Active Directory: Step 15 → Step 16
  - Security Configuration: Step 16 → Step 17
  - Software Defined Networking: Step 17 → Step 18
- **State Management** - Added `securityConfiguration`, `securitySettings`, `storagePoolConfiguration`, `witnessType`, and `autoScrollEnabled` to wizard state
- **Step Flow** - Integrated new configuration steps into wizard flow visibility logic
- **Port Configuration Scrolling** - Selecting network adapter ports now scrolls directly to Port Configuration section for immediate setup

### Fixed
- **Auto-Scroll Accuracy** - Fixed mapping for scenario selection to properly scroll through all steps (was skipping Azure Cloud selection)

---

## [0.1.1] - 2025-12-15

### Fixed
- **CIDR Calculator** - Added missing `ipToLong()` and `longToIp()` utility functions that caused runtime error when opening the Subnet Calculator

### Changed
- **UI Layout** - Moved Import/Export Config buttons from header to Configuration Summary panel for better accessibility while scrolling
- **CIDR Calculator Position** - Relocated Subnet Calculator button from header to Step 12 (Infrastructure Network) where IP addresses are configured

### Removed
- **Cost Estimator** - Removed cost estimation feature (button and functionality)
- **Prerequisites Checklist** - Removed prerequisites modal and banner as requirements vary by deployment scenario (Rack Aware vs Multi-Rack)

---

## [0.1.0] - 2025-12-15

### 🎉 Major Release - Enhanced User Experience & Developer Tools

This release represents a comprehensive enhancement of Odin for Azure Local with 23 major improvements spanning user experience, technical capabilities, security, and documentation.

### Added

#### User Experience
- **Auto-Save & Resume** - Automatic progress saving to localStorage with resume capability
- **Export/Import Configuration** - Save and load configurations as JSON files with versioning
- **CIDR Calculator** - Built-in subnet calculator with network details
- **Cost Estimator** - Monthly cost estimation based on configuration
- **Prerequisites Checklist** - Comprehensive checklist modal with all requirements
- **Comparison Views** - Side-by-side comparisons for Storage, Outbound, Arc Gateway, and Intent options
- **Real-time Validation** - Instant feedback on input fields with color-coded messages
- **Contextual Help System** - Help modals for complex topics (NetBIOS, RDMA, ToR, VLAN, CIDR, SDN)
- **Toast Notifications** - Non-intrusive feedback for user actions
- **What's New Modal** - Comprehensive changelog accessible from header

#### Technical Enhancements
- **Version Tracking** - All exports include version 3.1.0 identifier
- **Change Detection** - Import process detects and reports changes
- **Enhanced Validation** - Improved validation functions for NetBIOS, IPv4, CIDR, VLAN, domain names
- **Input Sanitization** - Context-aware sanitization (HTML, JSON, URL, filename)
- **Copy to Clipboard** - Utility function with fallback for older browsers
- **LocalStorage Integration** - Robust state persistence with error handling

#### Security
- **HTTP Security Headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Enhanced Sanitization** - All user inputs sanitized appropriately for context
- **Referrer Policy** - no-referrer policy added

#### Accessibility
- **Meta Tags** - SEO-friendly meta tags added
- **Semantic HTML** - Maintained throughout enhancements
- **Keyboard Navigation** - Enhanced keyboard support
- **Screen Reader Friendly** - Improved for assistive technologies

#### Documentation
- **README.md** - Comprehensive project documentation (500+ lines)
- **IMPLEMENTATION_SUMMARY.md** - Detailed summary of all 23 enhancements
- **EXPORT_FORMATS.md** - Guide for current and future export formats
- **FRAMEWORK_MIGRATION.md** - Detailed guide for migrating to React/Vue/Svelte
- **QUICK_START.md** - Quick reference guide for users
- **CHANGELOG.md** - This file

#### Testing
- **Unit Test Suite** - Interactive test runner (tests.html) with 50+ tests
- **Validation Tests** - Comprehensive tests for all validation functions
- **Visual Test Results** - Color-coded pass/fail indicators

### Enhanced

#### Existing Features
- **ARM Parameters Page** - Copy to clipboard already implemented, now documented
- **Report Generation** - Architecture diagrams continue to update in real-time
- **State Management** - Centralized with auto-save capability
- **Error Handling** - Improved error messages and user feedback

#### UI Components
- **Header** - Added action buttons (Import, Export, Calculator, Cost Estimate)
- **Step Headers** - Added "Compare Options" buttons on key decision steps
- **Prerequisites Banner** - Prominent blue banner before wizard starts
- **Version Display** - Version number and "What's New" link in header

### Infrastructure

#### Code Organization
- **Utility Functions** - Grouped and documented
- **Export Logic** - Modularized for future format additions
- **State Persistence** - Centralized localStorage management
- **Modal System** - Reusable modal framework for all overlays

#### Developer Experience
- **Function Documentation** - All new functions documented
- **Code Comments** - Enhanced inline documentation
- **Migration Path** - Clear path to modern framework documented
- **Extension Points** - Easy to add new features

### Documentation Improvements

#### README.md
- Table of Contents
- Getting Started guide
- Prerequisites checklist
- Usage guide with navigation
- Configuration options tables
- Export formats documentation
- Development section
- Browser compatibility
- Troubleshooting guide
- Best practices
- Security considerations

#### Additional Guides
- Export format implementation guide
- Framework migration strategy
- Quick start reference
- Implementation summary

### Fixed
- No bug fixes in this release (enhancement-focused)

### Security
- Added HTTP security headers to all HTML files
- Enhanced input sanitization throughout
- Implemented context-aware escaping
- Added referrer policy

### Performance
- Maintained performance despite added features
- Efficient localStorage operations
- Lazy loading framework for modals
- No performance degradation

### Browser Compatibility
- Tested on Chrome/Edge 90+
- Tested on Firefox 88+
- Tested on Safari 14+
- Tested on Opera 76+
- IE explicitly not supported (documented)

---

## [0.0.1] - 2025-11-XX (Prior Release)

### Added
- Initial wizard framework
- Multiple deployment scenarios support
- Network configuration steps
- ARM parameters generation
- HTML report generation
- Word-compatible report export
- Summary panel with real-time updates
- Architecture diagram generation
- Validation system
- State management

### Features
- Hyperconverged, Disaggregated, Disconnected, Multi-Rack scenarios
- Azure cloud selection (Public, Government, China)
- Scale options (single-site, rack-aware)
- Node count selection (1-16+)
- Port configuration
- Storage connectivity (switched/switchless)
- Network intent configuration
- Outbound connectivity options
- Arc Gateway configuration
- IP assignment (static/DHCP)
- Infrastructure network configuration
- Identity options (Active Directory/Local Identity)
- DNS configuration
- SDN features (optional)

---

## Version Comparison

| Feature | v0.0.1 | v0.1.0 |
|---------|--------|--------|
| Core Wizard | ✅ | ✅ |
| ARM Export | ✅ | ✅ |
| Report Generation | ✅ | ✅ |
| Auto-Save | ❌ | ✅ |
| Import/Export Config | ❌ | ✅ |
| CIDR Calculator | ❌ | ✅ |
| Cost Estimator | ❌ | ✅ |
| Prerequisites Modal | ❌ | ✅ |
| Comparison Views | ❌ | ✅ |
| Real-time Validation | ❌ | ✅ |
| Contextual Help | ❌ | ✅ |
| Toast Notifications | ❌ | ✅ |
| Unit Tests | ❌ | ✅ |
| Comprehensive Docs | ❌ | ✅ |
| Security Headers | ❌ | ✅ |
| Version Tracking | ❌ | ✅ |
| Change Detection | ❌ | ✅ |

---

## Migration Guide

### From v0.0.1 to v0.1.0

**Automatic Migration**: No action required!

1. **Saved State**: Old localStorage state is automatically compatible
2. **Exports**: Old reports and ARM parameters continue to work
3. **New Features**: All new features are additive, nothing removed
4. **Breaking Changes**: None

**What's New for You**:
- Progress now auto-saves automatically
- Click "Export Config" to save complete configuration
- Use CIDR Calculator for IP planning
- Check Cost Estimate before deployment
- Review Prerequisites before starting
- Compare options before making decisions

---

## Upcoming Features (Future Releases)

### v0.2.0 (Planned)
- [ ] Bicep template export
- [ ] Terraform configuration export
- [ ] PowerShell deployment script export
- [ ] Azure Pricing API integration for accurate costs
- [ ] Multi-language support (translations)
- [ ] Dark mode toggle
- [ ] Configuration templates for common scenarios

### v0.3.0 (Planned)
- [ ] Collaboration features (share via URL)
- [ ] Configuration comparison tool
- [ ] Deployment checklist generator
- [ ] Integration with Azure Resource Graph
- [ ] Real-time Azure quota checking

### v0.4.0 (Planned)
- [ ] Migration to React + TypeScript
- [ ] Component-based architecture
- [ ] Enhanced performance
- [ ] Progressive Web App (PWA)
- [ ] Offline support
- [ ] Advanced state management

---

## Breaking Changes

### v0.1.0
**None** - Fully backward compatible with v0.0.1

### v0.0.1
- Initial release (no prior versions)

---

## Deprecation Notices

### v0.1.0
**None** - No features deprecated

### Future Considerations
- Direct DOM manipulation may be replaced in v4.0.0 (React migration)
- Global state object may be replaced with proper state management
- LocalStorage may be supplemented with IndexedDB for larger data

---

## Contributors

### v0.1.0
- Enhanced by AI assistant based on comprehensive improvement recommendations
- All 23 recommendations implemented systematically
- Tested across multiple browsers
- Documented extensively

### v0.0.1
- Original framework and wizard implementation
- Core decision logic and validation
- ARM parameters generation
- Report generation with diagrams

---

## Support

For questions, issues, or feature requests:
- **GitHub Issues** - Report bugs or request features
- **Documentation** - Consult README.md and other guides
- **Azure Local Docs** - [learn.microsoft.com/azure-stack/hci/](https://learn.microsoft.com/azure-stack/hci/)

---

## License

This project is provided as-is for planning and configuration purposes. See official Azure documentation for deployment guidance and support.

---

**Maintained by**: Azure Local Community  
**Repository**: GitHub - Azure/AzureLocal-Supportability  
**Last Updated**: December 15, 2025

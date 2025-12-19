# Changelog

All notable changes to Odin for Azure Local (Optimal Deployment and Infrastructure Navigator) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - **Hyperconverged (2-3 nodes)**: Both Single and Dual ToR options available, defaulting to Dual
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

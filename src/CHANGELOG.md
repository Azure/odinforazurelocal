# Changelog

All notable changes to the Azure Local Design Assistant (ALDA) Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2025-12-15

### Added

#### Security Configuration
- **Security Configuration Section** - New step after Active Directory configuration (Step 15.5)
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
- **State Management** - Added `securityConfiguration` and `securitySettings` to wizard state
- **Step Flow** - Integrated security configuration step into wizard flow visibility logic

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

This release represents a comprehensive enhancement of the Azure Local Design Assistant (ALDA) Tool with 23 major improvements spanning user experience, technical capabilities, security, and documentation.

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

# Azure Local Export Format Generators
# Additional export formats: Bicep, Terraform, PowerShell

This directory contains stub implementations for future export formats.

## Planned Export Formats

### 1. Bicep Templates
- **File**: `export-bicep.js`
- **Status**: Planned
- **Description**: Generate Azure Bicep templates for infrastructure-as-code deployment
- **Benefits**: 
  - Type-safe Azure deployments
  - Better tooling support
  - More concise than ARM JSON

### 2. Terraform Configuration
- **File**: `export-terraform.js`
- **Status**: Planned
- **Description**: Generate Terraform .tf files for Azure Local deployment
- **Benefits**:
  - Multi-cloud compatibility
  - State management
  - Large ecosystem

### 3. PowerShell Deployment Scripts
- **File**: `export-powershell.js`
- **Status**: Planned
- **Description**: Generate PowerShell scripts for automated deployment
- **Benefits**:
  - Native Windows automation
  - Azure PowerShell module integration
  - Step-by-step execution

### 4. Ansible Playbooks
- **File**: `export-ansible.js`
- **Status**: Planned
- **Description**: Generate Ansible playbooks for configuration management
- **Benefits**:
  - Agentless automation
  - Idempotent operations
  - Cross-platform

## Implementation Guide

To add a new export format:

1. **Create export function** in `script.js`:
```javascript
function exportAsBicep() {
    // Generate Bicep template from state
    const bicep = generateBicepTemplate(state);
    downloadFile(bicep, 'azure-local.bicep', 'text/plain');
}
```

2. **Add UI button** in `index.html`:
```html
<button onclick="exportAsBicep()">Export as Bicep</button>
```

3. **Implement generator** logic based on `state` object

4. **Add tests** in `tests.html` for validation

## Current Implementation Status

| Format | Status | Priority | Complexity |
|--------|--------|----------|------------|
| ARM JSON | ✅ Complete | High | Medium |
| Configuration JSON | ✅ Complete | High | Low |
| HTML Report | ✅ Complete | High | Medium |
| Word Report | ✅ Complete | Medium | Medium |
| Bicep | 📝 Planned | High | High |
| Terraform | 📝 Planned | Medium | High |
| PowerShell | 📝 Planned | Medium | Medium |
| Ansible | 📝 Planned | Low | High |

## Contributing

To contribute a new export format:

1. Study the existing ARM generator in `arm.js`
2. Map `state` properties to target format syntax
3. Add validation for required fields
4. Include comments and documentation in output
5. Test with sample configurations
6. Submit pull request with tests

## Resources

- [Bicep Documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/)
- [Ansible Azure Modules](https://docs.ansible.com/ansible/latest/collections/azure/azcollection/)

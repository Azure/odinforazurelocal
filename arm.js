(function () {
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function highlightJson(jsonText) {
        // Minimal JSON highlighter (no external deps).
        // Produces HTML with spans. Assumes `jsonText` is already pretty-printed.
        var s = String(jsonText || '');
        var out = '';
        var i = 0;

        function isWs(ch) { return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'; }
        function peekNonWs(start) {
            for (var j = start; j < s.length; j++) {
                var c = s[j];
                if (!isWs(c)) return c;
            }
            return '';
        }

        while (i < s.length) {
            var ch = s[i];

            // Whitespace
            if (isWs(ch)) {
                out += ch;
                i++;
                continue;
            }

            // Strings
            if (ch === '"') {
                var start = i;
                i++; // consume opening quote
                var escaped = false;
                while (i < s.length) {
                    var c2 = s[i];
                    if (escaped) {
                        escaped = false;
                        i++;
                        continue;
                    }
                    if (c2 === '\\') {
                        escaped = true;
                        i++;
                        continue;
                    }
                    if (c2 === '"') {
                        i++; // consume closing quote
                        break;
                    }
                    i++;
                }

                var strToken = s.slice(start, i);
                var next = peekNonWs(i);
                var cls = (next === ':') ? 'json-token--key' : 'json-token--string';
                out += '<span class="' + cls + '">' + escapeHtml(strToken) + '</span>';
                continue;
            }

            // Numbers
            if (ch === '-' || (ch >= '0' && ch <= '9')) {
                var numMatch = s.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+\-]?\d+)?/);
                if (numMatch && numMatch[0]) {
                    var numTok = numMatch[0];
                    out += '<span class="json-token--number">' + escapeHtml(numTok) + '</span>';
                    i += numTok.length;
                    continue;
                }
            }

            // Literals
            if (s.slice(i, i + 4) === 'true') {
                out += '<span class="json-token--boolean">true</span>';
                i += 4;
                continue;
            }
            if (s.slice(i, i + 5) === 'false') {
                out += '<span class="json-token--boolean">false</span>';
                i += 5;
                continue;
            }
            if (s.slice(i, i + 4) === 'null') {
                out += '<span class="json-token--null">null</span>';
                i += 4;
                continue;
            }

            // Punctuation / fallback
            out += '<span class="json-token--punct">' + escapeHtml(ch) + '</span>';
            i++;
        }

        return out;
    }

    function tryParsePayload() {
        // 1) URL hash payload (preferred for file:// reliability)
        try {
            var hash = window.location.hash || '';
            var idx = hash.indexOf('data=');
            if (idx >= 0) {
                var encoded = hash.substring(idx + 5);
                encoded = decodeURIComponent(encoded);
                var json = decodeURIComponent(escape(atob(encoded)));
                return JSON.parse(json);
            }
        } catch (e) {
            // ignore
        }

        // 2) localStorage fallback
        try {
            var raw = localStorage.getItem('azloc_arm_payload');
            if (raw) return JSON.parse(raw);
        } catch (e2) {
            // ignore
        }

        return null;
    }

    function setMeta(metaEl, payload) {
        if (!metaEl) return;
        if (!payload) {
            metaEl.innerHTML = '<div style="color:var(--text-secondary);">No payload found. Generate ARM parameters from the wizard first.</div>';
            return;
        }

        var generatedAt = payload.generatedAt ? String(payload.generatedAt) : '';
        var version = payload.version ? String(payload.version) : '';
        var cloud = payload.cloud ? String(payload.cloud) : '';
        var ref = payload.referenceTemplate || null;
        var refName = ref && ref.name ? String(ref.name) : '';
        var refUrl = ref && ref.url ? String(ref.url) : '';

        function formatCloud(s) {
            if (s === 'azure_government') return 'Azure Government';
            if (s === 'azure_commercial') return 'Azure Commercial';
            if (s === 'azure_china') return 'Azure China';
            return s || '';
        }

        metaEl.innerHTML = ''
            + '<div style="display:flex; flex-direction:column; gap:0.35rem;">'
            + '<div><strong>Generated:</strong> <span style="color:var(--text-secondary);">' + escapeHtml(generatedAt || '-') + '</span></div>'
            + '<div><strong>Format:</strong> <span style="color:var(--text-secondary);">Azure deploymentParameters.json</span></div>'
            + (cloud ? ('<div><strong>Azure Cloud:</strong> <span style="color:var(--text-secondary);">' + escapeHtml(formatCloud(cloud)) + '</span></div>') : '')
            + (refUrl ? ('<div><strong>Reference template:</strong> <a href="' + escapeHtml(refUrl) + '" target="_blank" rel="noopener" style="color:var(--accent-blue);">' + escapeHtml(refName || refUrl) + '</a></div>') : '')
            + (version ? ('<div><strong>Wizard version:</strong> <span style="color:var(--text-secondary);">' + escapeHtml(version) + '</span></div>') : '')
            + '</div>';
    }

    function setPlaceholders(placeholdersEl, placeholders) {
        if (!placeholdersEl) return;

        var list = Array.isArray(placeholders) ? placeholders : [];
        var inputContainer = document.getElementById('arm-placeholder-inputs');
        
        if (list.length === 0) {
            placeholdersEl.innerHTML = '<div class="info-box visible">No placeholders reported.</div>';
            if (inputContainer) inputContainer.style.display = 'none';
            return;
        }

        placeholdersEl.innerHTML = ''
            + '<div class="info-box visible">'
            + '<strong>These values are placeholders:</strong>'
            + '<ul style="margin:0.5rem 0 0 1.1rem; color:var(--text-secondary);">'
            + list.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join('')
            + '</ul>'
            + '<p style="margin-top:0.75rem;font-size:0.9rem;">Use the fields below to populate deployment details:</p>'
            + '</div>';
            
        // Show input fields
        if (inputContainer) inputContainer.style.display = 'block';
    }

    function attachCopy(copyBtn, statusEl, getText) {
        if (!copyBtn || !getText) return;

        function setStatus(msg) {
            if (!statusEl) return;
            statusEl.textContent = msg || '';
        }

        copyBtn.addEventListener('click', async function () {
            try {
                var text = String(getText() || '');
                if (!text) {
                    setStatus('Nothing to copy.');
                    return;
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    setStatus('Copied to clipboard.');
                    return;
                }

                // Fallback
                var tmp = document.createElement('textarea');
                tmp.value = text;
                tmp.setAttribute('readonly', 'readonly');
                tmp.style.position = 'fixed';
                tmp.style.left = '-9999px';
                tmp.style.top = '0';
                document.body.appendChild(tmp);
                tmp.focus();
                tmp.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(tmp);
                setStatus(ok ? 'Copied to clipboard.' : 'Copy failed.');
            } catch (e) {
                setStatus('Copy failed.');
            }
        });
    }

    function main() {
        var payload = tryParsePayload();

        var metaEl = document.getElementById('arm-meta');
        var placeholdersEl = document.getElementById('arm-placeholders');
        var codeEl = document.getElementById('arm-json-code');
        var copyBtn = document.getElementById('arm-copy-btn');
        var statusEl = document.getElementById('arm-copy-status');

        setMeta(metaEl, payload);

        if (!payload || !payload.parametersFile) {
            if (placeholdersEl) placeholdersEl.innerHTML = '<div class="info-box visible">No data to display.</div>';
            if (codeEl) codeEl.textContent = '';
            if (copyBtn) copyBtn.disabled = true;
            return;
        }

        var readiness = payload.readiness || {};
        setPlaceholders(placeholdersEl, readiness.placeholders);

        var rawJsonText = '';
        try {
            rawJsonText = JSON.stringify(payload.parametersFile, null, 2);
        } catch (e2) {
            rawJsonText = String(payload.parametersFile);
        }

        if (codeEl) codeEl.innerHTML = highlightJson(rawJsonText);

        if (copyBtn) copyBtn.disabled = false;
        attachCopy(copyBtn, statusEl, function () { return rawJsonText; });
    }

    main();
})();

// Integration Features Functions
function generateDevOpsPipeline() {
    const payload = window.opener && window.opener.generateArmParameters ? window.opener.generateArmParameters() : null;
    
    const pipeline = `# Azure DevOps Pipeline for Azure Local Deployment
# Generated by Odin for Azure Local

trigger:
  branches:
    include:
    - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  resourceGroupName: 'REPLACE_WITH_RESOURCE_GROUP_NAME'
  location: 'REPLACE_WITH_LOCATION'
  templateFile: 'azurelocal-template.json'
  parametersFile: 'azurelocal-parameters.json'

stages:
- stage: Validate
  displayName: 'Validate Template'
  jobs:
  - job: ValidateJob
    displayName: 'Validate ARM Template'
    steps:
    - task: AzureCLI@2
      displayName: 'Validate ARM Template'
      inputs:
        azureSubscription: '\$(azureServiceConnection)'
        scriptType: 'bash'
        scriptLocation: 'inlineScript'
        inlineScript: |
          az deployment group validate \\
            --resource-group \$(resourceGroupName) \\
            --template-file \$(templateFile) \\
            --parameters @\$(parametersFile)

- stage: Deploy
  displayName: 'Deploy Azure Local'
  dependsOn: Validate
  condition: succeeded()
  jobs:
  - deployment: DeployJob
    displayName: 'Deploy to Azure'
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureCLI@2
            displayName: 'Deploy ARM Template'
            inputs:
              azureSubscription: '\$(azureServiceConnection)'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az deployment group create \\
                  --resource-group \$(resourceGroupName) \\
                  --template-file \$(templateFile) \\
                  --parameters @\$(parametersFile) \\
                  --mode Incremental
`;

    downloadFile('azure-pipelines.yml', pipeline);
    showNotification('Azure DevOps pipeline template downloaded!');
}

function generateGitHubWorkflow() {
    const payload = window.opener && window.opener.generateArmParameters ? window.opener.generateArmParameters() : null;
    
    const workflow = `# GitHub Actions Workflow for Azure Local Deployment
# Generated by Odin for Azure Local

name: Deploy Azure Local

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

env:
  RESOURCE_GROUP: REPLACE_WITH_RESOURCE_GROUP_NAME
  LOCATION: REPLACE_WITH_LOCATION
  TEMPLATE_FILE: azurelocal-template.json
  PARAMETERS_FILE: azurelocal-parameters.json

jobs:
  validate:
    name: Validate Template
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Validate ARM Template
        uses: azure/CLI@v1
        with:
          inlineScript: |
            az deployment group validate \\
              --resource-group \${{ env.RESOURCE_GROUP }} \\
              --template-file \${{ env.TEMPLATE_FILE }} \\
              --parameters @\${{ env.PARAMETERS_FILE }}

  deploy:
    name: Deploy to Azure
    needs: validate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy ARM Template
        uses: azure/CLI@v1
        with:
          inlineScript: |
            az deployment group create \\
              --resource-group \${{ env.RESOURCE_GROUP }} \\
              --template-file \${{ env.TEMPLATE_FILE }} \\
              --parameters @\${{ env.PARAMETERS_FILE }} \\
              --mode Incremental

      - name: Deployment Summary
        run: |
          echo "## Deployment Complete :rocket:" >> \$GITHUB_STEP_SUMMARY
          echo "Resource Group: \${{ env.RESOURCE_GROUP }}" >> \$GITHUB_STEP_SUMMARY
          echo "Location: \${{ env.LOCATION }}" >> \$GITHUB_STEP_SUMMARY
`;

    downloadFile('.github-workflows-deploy.yml', workflow);
    showNotification('GitHub Actions workflow downloaded! Save as .github/workflows/deploy.yml');
}

function showRestApiInfo() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(8px);';
    
    overlay.innerHTML = `
        <div style="background: var(--card-bg); border: 2px solid var(--accent-blue); border-radius: 16px; padding: 32px; max-width: 700px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔌</div>
                <h2 style="margin: 0 0 12px 0; color: var(--accent-blue); font-size: 24px;">REST API for Automation</h2>
                <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin: 0;">
                    Automate Azure Local deployments programmatically
                </p>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; color: var(--accent-purple); font-size: 16px;">API Endpoint</h3>
                <code style="display: block; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; color: var(--accent-blue); font-size: 13px; overflow-x: auto;">
                    POST /api/v1/generate-parameters
                </code>
            </div>

            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; color: var(--accent-purple); font-size: 16px;">Example Request</h3>
                <pre style="margin: 0; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; color: var(--text-primary); font-size: 12px; overflow-x: auto; line-height: 1.5;"><code>{
  "scenario": "hyperconverged",
  "scale": "standard",
  "nodes": 4,
  "ports": 4,
  "storage": "switched",
  "intent": "storage_compute",
  "outbound": "public"
}</code></pre>
            </div>

            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; color: var(--accent-purple); font-size: 16px;">Features</h3>
                <ul style="margin: 8px 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
                    <li>Generate ARM parameters from configuration JSON</li>
                    <li>Validate configuration before deployment</li>
                    <li>Batch processing for multiple deployments</li>
                    <li>Webhook integration for CI/CD pipelines</li>
                </ul>
            </div>

            <div style="padding: 16px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-blue); border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                    <strong style="color: var(--accent-blue);">Note:</strong> REST API is planned for future release. Contact your Microsoft representative for early access.
                </p>
            </div>
            
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="width: 100%; padding: 12px 24px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s;"
                    onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'"
                    onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
                Close
            </button>
        </div>
    `;
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showNotification(message, type) {
    type = type || 'success';
    const bgColor = type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)';
    
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${bgColor};
        color: white;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(function() {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(function() {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Update parameters when input fields change
 */
function updateParameters() {
    if (!window.armPayload || !window.armPayload.parametersFile) return;
    
    const subId = document.getElementById('input-subscription-id').value.trim();
    const rgName = document.getElementById('input-resource-group').value.trim();
    const deployName = document.getElementById('input-deployment-name').value.trim();
    
    // Create a copy of the parameters to modify
    const paramsFile = JSON.parse(JSON.stringify(window.armPayload.parametersFile));
    const params = paramsFile.parameters || {};
    
    // Update placeholder values
    for (const key in params) {
        const val = params[key].value;
        if (typeof val === 'string') {
            if (val === 'REPLACE_WITH_SUBSCRIPTION_ID' && subId) {
                params[key].value = subId;
            } else if (val === 'REPLACE_WITH_RESOURCE_GROUP' && rgName) {
                params[key].value = rgName;
            } else if (val === 'REPLACE_WITH_DEPLOYMENT_NAME' && deployName) {
                params[key].value = deployName;
            }
        }
    }
    
    // Update the display
    const jsonCode = document.getElementById('arm-json-code');
    if (jsonCode) {
        jsonCode.textContent = JSON.stringify(paramsFile, null, 2);
    }
}

/**
 * Generate PowerShell deployment script
 */
function generatePowerShellScript() {
    const subId = document.getElementById('input-subscription-id').value.trim();
    const rgName = document.getElementById('input-resource-group').value.trim();
    const deployName = document.getElementById('input-deployment-name').value.trim() || 'azurelocal-deployment';
    
    if (!subId || !rgName) {
        showNotification('Please fill in Subscription ID and Resource Group Name first', 'error');
        return;
    }
    
    const script = `# Azure Local Deployment Script
# Generated by Odin for Azure Local

# Variables
$subscriptionId = "${subId}"
$resourceGroupName = "${rgName}"
$deploymentName = "${deployName}"
$location = "eastus"  # Change as needed
$templateFile = "azurelocal-template.json"
$parametersFile = "azurelocal-parameters.json"

# Connect to Azure
Connect-AzAccount

# Set subscription context
Set-AzContext -SubscriptionId $subscriptionId

# Create resource group if it doesn't exist
$rg = Get-AzResourceGroup -Name $resourceGroupName -ErrorAction SilentlyContinue
if (-not $rg) {
    Write-Host "Creating resource group: $resourceGroupName"
    New-AzResourceGroup -Name $resourceGroupName -Location $location
}

# Deploy the ARM template
Write-Host "Starting deployment: $deploymentName"
New-AzResourceGroupDeployment \`
    -Name $deploymentName \`
    -ResourceGroupName $resourceGroupName \`
    -TemplateFile $templateFile \`
    -TemplateParameterFile $parametersFile \`
    -Verbose

Write-Host "Deployment completed successfully!"
`;

    downloadFile('deploy-azurelocal.ps1', script);
    showNotification('PowerShell script downloaded successfully!', 'success');
}

/**
 * Generate Azure CLI deployment command
 */
function generateAzCLIScript() {
    const subId = document.getElementById('input-subscription-id').value.trim();
    const rgName = document.getElementById('input-resource-group').value.trim();
    const deployName = document.getElementById('input-deployment-name').value.trim() || 'azurelocal-deployment';
    
    if (!subId || !rgName) {
        showNotification('Please fill in Subscription ID and Resource Group Name first', 'error');
        return;
    }
    
    const script = `#!/bin/bash
# Azure Local Deployment Script
# Generated by Odin for Azure Local

# Variables
SUBSCRIPTION_ID="${subId}"
RESOURCE_GROUP="${rgName}"
DEPLOYMENT_NAME="${deployName}"
LOCATION="eastus"  # Change as needed
TEMPLATE_FILE="azurelocal-template.json"
PARAMETERS_FILE="azurelocal-parameters.json"

# Login to Azure
az login

# Set subscription
az account set --subscription "$SUBSCRIPTION_ID"

# Create resource group if it doesn't exist
az group create \\
    --name "$RESOURCE_GROUP" \\
    --location "$LOCATION"

# Deploy the ARM template
echo "Starting deployment: $DEPLOYMENT_NAME"
az deployment group create \\
    --name "$DEPLOYMENT_NAME" \\
    --resource-group "$RESOURCE_GROUP" \\
    --template-file "$TEMPLATE_FILE" \\
    --parameters "@$PARAMETERS_FILE" \\
    --verbose

echo "Deployment completed successfully!"
`;

    downloadFile('deploy-azurelocal.sh', script);
    showNotification('Azure CLI script downloaded successfully!', 'success');
}

/**
 * Show Bicep/Terraform alternatives information
 */
function showBicepTerraformAlternatives() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;';
    
    modal.innerHTML = `
        <div style="background:var(--bg-dark);border:1px solid var(--glass-border);border-radius:8px;padding:2rem;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h2 style="margin:0;color:var(--text-primary);font-size:1.5rem;">Infrastructure as Code Alternatives</h2>
                <button onclick="this.closest('div').parentElement.remove()" style="background:none;border:none;color:var(--text-primary);font-size:1.5rem;cursor:pointer;padding:0;width:30px;height:30px;">×</button>
            </div>
            
            <div style="display:flex;flex-direction:column;gap:1.5rem;">
                <div style="padding:1rem;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:6px;">
                    <h3 style="margin:0 0 0.75rem 0;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"/>
                            <polyline points="8 6 2 12 8 18"/>
                        </svg>
                        Bicep (Recommended)
                    </h3>
                    <p style="margin:0 0 0.75rem 0;color:var(--text-secondary);line-height:1.5;">
                        Bicep is Microsoft's domain-specific language for deploying Azure resources. It provides simpler syntax than ARM templates.
                    </p>
                    <div style="background:#1e1e1e;padding:1rem;border-radius:4px;margin-bottom:0.75rem;">
                        <code style="color:#ce9178;font-family:monospace;font-size:0.9rem;">
                            az bicep decompile --file azurelocal-template.json
                        </code>
                    </div>
                    <a href="https://learn.microsoft.com/azure/azure-resource-manager/bicep/" target="_blank" style="color:#4a9eff;text-decoration:none;">
                        Learn more about Bicep →
                    </a>
                </div>
                
                <div style="padding:1rem;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:6px;">
                    <h3 style="margin:0 0 0.75rem 0;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Terraform (Azure Provider)
                    </h3>
                    <p style="margin:0 0 0.75rem 0;color:var(--text-secondary);line-height:1.5;">
                        Terraform is a popular multi-cloud IaC tool. Use the AzureRM provider to manage Azure Local resources.
                    </p>
                    <div style="background:#1e1e1e;padding:1rem;border-radius:4px;margin-bottom:0.75rem;">
                        <code style="color:#ce9178;font-family:monospace;font-size:0.9rem;">
                            terraform plan -out=azurelocal.tfplan<br>
                            terraform apply azurelocal.tfplan
                        </code>
                    </div>
                    <a href="https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs" target="_blank" style="color:#4a9eff;text-decoration:none;">
                        Learn more about Terraform Azure Provider →
                    </a>
                </div>
                
                <div style="padding:1rem;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:6px;">
                    <h3 style="margin:0 0 0.75rem 0;color:var(--text-primary);">Conversion Tools</h3>
                    <ul style="margin:0;padding-left:1.5rem;color:var(--text-secondary);line-height:1.8;">
                        <li>Use <strong style="color:var(--text-primary);">az bicep decompile</strong> to convert ARM to Bicep</li>
                        <li>Use <strong style="color:var(--text-primary);">aztfy</strong> (Azure Terraform Exporter) to generate Terraform configurations</li>
                        <li>Manually convert ARM templates to Terraform using provider documentation</li>
                    </ul>
                </div>
            </div>
            
            <button onclick="this.closest('div').parentElement.remove()" class="report-button" style="width:100%;margin-top:1.5rem;padding:0.75rem;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
}
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

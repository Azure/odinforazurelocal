/* global showOdinOnboarding */
/* exported initializeArmHelp */

const ARM_ONBOARDING_KEY = 'odin_arm_onboarding_v1';
let armHelpOpen = false;

function getArmHelpSteps(disconnected) {
    return [
        {
            title: 'Welcome to ARM deployment preparation',
            description: 'Turn your Designer configuration into deployment-ready files. ODIN prepares the files; it does not execute or monitor a deployment.',
            features: [
                { icon: '\u{1F30D}', title: 'Azure Context', text: 'Select your Azure region or choose Custom to enter a region code. Complete the subscription and resource group details for your deployment.' },
                { icon: '\u{1F5A5}', title: 'Cluster Configuration', text: 'Review the cluster name, identity, and applicable configuration fields. Optional fields are labeled.' },
                { icon: '\u{1F511}', title: 'Azure Resources', text: 'Complete the resource values needed by your template. Entered values update the parameter JSON immediately.' },
                { icon: '\u{1F50E}', title: 'Check Placeholders', text: 'Replace every remaining REPLACE_WITH_ placeholder before deployment, including values not collected on this page.' }
            ]
        },
        {
            title: disconnected ? 'Use the disconnected deployment workflow' : 'Validate first, then Deploy',
            description: disconnected
                ? 'Follow the Disconnected Operations guide linked on this page. Run deployments from your authorized local management environment, not the public Azure Portal.'
                : 'Azure Local uses two real ARM deployments. ARM preflight validation and What-If do not replace the first deployment.',
            features: [
                { icon: '\u{2705}', title: '1. Validate', text: disconnected
                    ? 'Where the selected template uses deploymentMode, run Validate first and wait for success. Preflight and What-If do not replace a real Validate deployment.'
                    : 'Keep Deployment Mode set to Validate for the first real ARM deployment. Wait for success and confirm the cluster resource exists.' },
                { icon: '\u{1F680}', title: '2. Deploy', text: 'Select Deploy and run a second ARM deployment using the same template and cluster context.' },
                { icon: '\u{1F517}', title: 'Keep the Same Context', text: 'Use the same template, subscription, resource group, and cluster name for both deployment phases.' },
                { icon: '\u{1F6E0}', title: 'You Run the Deployment', text: 'Changing the dropdown only changes your parameters. ODIN cannot check whether validation succeeded.' }
            ]
        },
        {
            title: 'Review, copy, or download your parameters',
            description: 'Review your files before running them. Reopen Help at any time without changing your entered values.',
            features: [
                { icon: '\u{1F4CB}', title: 'Review and Copy', text: 'Review the JSON after completing the fields. Copy actions use the currently selected deployment mode.' },
                { icon: '\u{1F4E5}', title: 'Phase-Specific Downloads', text: 'Download Validate Parameters and Download Deploy Parameters always produce the mode named on each button, regardless of the dropdown.' },
                { icon: '\u{2699}', title: 'Scripts and Workflows', text: 'Generated PowerShell, CLI, and CI workflows use your region. Select the appropriate phase and parameter file, and review them before running.' },
                { icon: '\u{1F4DA}', title: disconnected ? 'Local Deployment' : 'Azure Portal', text: disconnected
                    ? 'Use the local deployment tooling and instructions in the Disconnected Operations guide.'
                    : 'Open the template, choose Edit parameters, paste the JSON, replace any placeholders, and create the deployment.' }
            ]
        }
    ];
}

async function showArmHelp() {
    if (armHelpOpen) return;
    armHelpOpen = true;
    try {
        await showOdinOnboarding(getArmHelpSteps(window.armPayload && window.armPayload.scenario === 'disconnected'), 'arm-help');
        try {
            localStorage.setItem(ARM_ONBOARDING_KEY, 'completed');
        } catch (error) {
            reportUiError(error, 'Saving ARM help preference');
        }
    } finally {
        armHelpOpen = false;
    }
}

function initializeArmHelp() {
    let completed = false;
    try {
        completed = localStorage.getItem(ARM_ONBOARDING_KEY) === 'completed';
    } catch (error) {
        reportUiError(error, 'Reading ARM help preference');
    }
    if (!completed) {
        const help = document.getElementById('arm-help-btn');
        if (help) help.focus();
        showArmHelp().catch(error => reportUiError(error, 'Opening ARM help'));
    }
}

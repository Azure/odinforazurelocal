/* global showOdinOnboarding */
/* exported initializeReportHelp */

const REPORT_ONBOARDING_KEY = 'odin_report_onboarding_v1';
let reportHelpOpen = false;

function getReportHelpSteps() {
    return [
        {
            title: 'Your design documentation starting point',
            description: 'Turn ODIN configuration choices into a useful baseline for your Azure Local design and documentation.',
            features: [
                { icon: '\u{1F4CB}', title: 'Configuration Summary', text: 'Review the topology, networking, identity, and security settings selected in Designer.' },
                { icon: '\u{1F4CA}', title: 'Sizing Context', text: 'When supplied from Sizer, see hardware estimates, workloads, and sizing recommendations.' },
                { icon: '\u{1F5FA}', title: 'Diagrams', text: 'Use the applicable rack, host-networking, and outbound-connectivity diagrams to explain the proposed configuration.' },
                { icon: '\u{1F4A1}', title: 'Decisions and Guidance', text: 'Review configuration rationale, checks, and planning notes alongside their source references.' }
            ]
        },
        {
            title: 'Review, share, and extend',
            description: 'Use the report to support collaboration and further documentation, not as an automatic approval to deploy.',
            features: [
                { icon: '\u{1F50E}', title: 'Review the Details', text: 'Check assumptions, placeholders, warnings, and generated examples against your intended environment.' },
                { icon: '\u{1F4DD}', title: 'Editable Exports', text: 'Download Word or Markdown to add requirements, design decisions, and organisation-specific detail.' },
                { icon: '\u{1F4CA}', title: 'Present and Print', text: 'Export PowerPoint for discussions, or use Print Friendly and Save as PDF for sharing.' },
                { icon: '\u{1F504}', title: 'Keep It Current', text: 'Update Designer or Sizer and generate a new report when inputs change. Report checks do not validate a live deployment.' }
            ]
        },
        {
            title: 'Complete the wider solution design',
            description: 'ODIN does not capture a complete set of business or technical requirements for selecting and deploying Azure Local. Use this report as a starting point for your low-level design (LLD) documentation.',
            features: [
                { icon: '\u{1F3AF}', title: 'Business Requirements', text: 'Document business objectives, stakeholders, budget, success measures, and acceptance criteria.' },
                { icon: '\u{1F4D0}', title: 'Technical Requirements', text: 'Add availability and recovery targets, performance needs, constraints, dependencies, and security requirements.' },
                { icon: '\u{1F6E0}', title: 'Operational Ownership', text: 'Define support responsibilities, monitoring, backup and recovery, maintenance, and lifecycle processes.' },
                { icon: '\u{2705}', title: 'Review and Approve', text: 'Validate the solution against current Microsoft and OEM guidance and organisational requirements. This report does not replace your reviewed low-level design (LLD) documentation.' }
            ]
        }
    ];
}

async function showReportHelp() {
    if (reportHelpOpen) return;
    reportHelpOpen = true;
    try {
        await showOdinOnboarding(getReportHelpSteps(), 'report-help');
        try {
            localStorage.setItem(REPORT_ONBOARDING_KEY, 'completed');
        } catch (error) {
            reportUiError(error, 'Saving Report help preference');
        }
    } finally {
        reportHelpOpen = false;
    }
}

function initializeReportHelp() {
    let completed = false;
    try {
        completed = localStorage.getItem(REPORT_ONBOARDING_KEY) === 'completed';
    } catch (error) {
        reportUiError(error, 'Reading Report help preference');
    }
    if (!completed) {
        const help = document.getElementById('report-help-btn');
        if (help) help.focus();
        showReportHelp().catch(error => reportUiError(error, 'Opening Report help'));
    }
}

/* global showOdinOnboarding, showAddWorkloadModal */
/* exported startFoundryWorkload, showFoundrySizingHelp */

const FOUNDRY_SIZING_HELP_KEY = 'odin_foundry_sizing_help_v1';
let foundrySizingHelpOpen = false;

function getFoundrySizingHelpSteps() {
    return [
        {
            title: 'Foundry Local\nDefine your inference workload',
            description: 'Start with the model and application requirements. ODIN estimates infrastructure capacity, not validated inference performance.',
            features: [
                { icon: '\u{1F9E0}', title: 'Model and Runtime', text: 'Choose a model/version and quantization, then check its supported runtime and hardware. ONNX-GenAI supports CPU or GPU inference; vLLM requires GPUs.',
                    link: { label: 'Choose an inference runtime', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/concept-inference-runtimes' } },
                { icon: '\u{1F4DD}', title: 'Context and Tokens', text: 'Collect sample conversations, including instructions, history, and retrieved text. Count inputs and replies locally with the chosen model\'s tokenizer and chat format; record typical and longest lengths. Tokens are not words.',
                    link: { label: 'How tokenizers count text (Hugging Face)', url: 'https://huggingface.co/learn/llm-course/chapter2/4#encoding' } },
                { icon: '\u{1F465}', title: 'Active Demand', text: 'Use a pilot or request logs to count arrivals per second and requests running simultaneously at peak times. Load-test both separately: requests per second and maximum concurrency are different controls.',
                    link: { label: 'Set request rate and concurrency (generic vLLM CLI)', url: 'https://docs.vllm.ai/en/stable/cli/bench/serve/' } },
                { icon: '\u{23F1}', title: 'Performance Targets', text: 'Agree acceptable time to first token, output tokens per second, and end-to-end latency with application users. Compare benchmark percentiles, not just averages, at the expected peak load.',
                    link: { label: 'Read latency and throughput results (generic vLLM guide)', url: 'https://docs.vllm.ai/en/stable/benchmarking/cli/' } }
            ]
        },
        {
            title: 'Foundry Local\nChoose the serving infrastructure',
            description: 'Separate what serves the model from the worker-node capacity that hosts it.',
            features: [
                { icon: '\u{1F5A5}', title: 'Supported Worker Sizes', text: 'Match the chosen worker SKU to its published CPU, RAM, GPU count, and VRAM. Use the worker or GPU table, not the control-plane table, and check the required Azure Local version.',
                    link: { label: 'Supported AKS VM sizes', url: 'https://learn.microsoft.com/en-us/azure/aks-hybrid-edge/local/hyperconverged/scale-requirements#supported-values-for-worker-node-sizes' } },
                { icon: '\u{1F9E9}', title: 'Workers, Deployments, Replicas', text: 'List the models you will serve and the running copies needed for each. Set the deployment replica count explicitly; adding Kubernetes workers does not automatically add serving replicas.',
                    link: { label: 'Configure model deployments and replicas', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/reference-model-deployment-operator#modeldeployment-spec-fields' } },
                { icon: '\u{1F4CD}', title: 'Fit Each Replica', text: 'Check GPUs per replica against one worker\'s GPU capacity. All GPUs required by one vLLM replica must fit on the same AKS worker node; extra workers do not automatically pool their GPU memory.',
                    link: { label: 'GPU placement and parallelism', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/concept-gpu-inference-planner#implementation-constraints' } },
                { icon: '\u{1F4CA}', title: 'Understand ODIN Totals', text: 'Review the included control plane, worker capacity, OS disks, and cache. Model-deployment count sizes cache storage, not user concurrency or serving replicas. Compare this estimate with Microsoft\'s infrastructure requirements.',
                    link: { label: 'Check infrastructure and model-cache requirements', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements' } }
            ]
        },
        {
            title: 'Foundry Local\nValidate before committing hardware',
            description: 'Use representative measurements to turn an infrastructure estimate into a reviewed deployment plan. Generic benchmarking examples must be adapted to your endpoint, authentication, model, and installed runtime. Keep test data local and use synthetic or approved samples.',
            features: [
                { icon: '\u{1F50E}', title: 'Validate Memory Fit', text: 'Set a combined prompt/output context limit when required. Deploy in a test environment and review startup validation; the vLLM planner provides a memory-safe starting point, not a throughput guarantee.',
                    link: { label: 'Automatic GPU inference tuning', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/concept-gpu-inference-planner' } },
                { icon: '\u{1F9EA}', title: 'Benchmark Real Traffic', text: 'Run representative prompt/reply lengths at increasing request rates and concurrency. Save results and compare latency, throughput, and errors with your targets. Generic tools need endpoint and version compatibility checks.',
                    link: { label: 'Run a serving benchmark (generic vLLM guide)', url: 'https://docs.vllm.ai/en/stable/benchmarking/cli/' } },
                { icon: '\u{1F6E1}', title: 'Plan Headroom and Availability', text: 'Reserve capacity for services, growth, maintenance, and failures. Test replica placement and service recovery during a planned worker outage in a non-production environment; extra workers alone do not prove availability.',
                    link: { label: 'Plan multi-node serving and replica routing', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/concept-multi-node-deployment' } },
                { icon: '\u{2705}', title: 'Review the Complete Design', text: 'Record the model, runtime, worker SKU, test load, measured results, and assumptions. Review them with your OEM and application owners against current requirements before procurement or production deployment.',
                    link: { label: 'Foundry Local requirements', url: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/concept-requirements' } }
            ]
        }
    ];
}

async function showFoundrySizingHelp() {
    if (foundrySizingHelpOpen) return;
    foundrySizingHelpOpen = true;
    try {
        await showOdinOnboarding(getFoundrySizingHelpSteps(), 'foundry-sizing-help', true);
        try {
            localStorage.setItem(FOUNDRY_SIZING_HELP_KEY, 'completed');
        } catch (error) {
            reportUiError(error, 'Saving Foundry sizing help preference');
        }
    } finally {
        foundrySizingHelpOpen = false;
    }
}

async function startFoundryWorkload() {
    if (foundrySizingHelpOpen) return;
    let completed = false;
    try {
        completed = localStorage.getItem(FOUNDRY_SIZING_HELP_KEY) === 'completed';
    } catch (error) {
        reportUiError(error, 'Reading Foundry sizing help preference');
    }
    if (!completed) await showFoundrySizingHelp();
    showAddWorkloadModal('foundry');
}

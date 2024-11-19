import { Agent } from "~/lib/agents/agent-generator";
import { TEMPLATE_LIST } from "./constants";
import { webcontainer } from "~/lib/webcontainer";




let codeTemplateAgent = new Agent({
    agentId: 'project-scaffold',
    name: 'Project Scaffolding Agent',
    description: 'Initializes new projects by selecting and applying appropriate project templates',
    purpose: `Initialize new projects only at the start of development. 
    This agent should only be selected for queries that needs to setup a framework/codebase, 
    NOT for general coding questions or existing projects.
    MUST USE THIS ONLY AT THE START OF DEVELOPMENT.
    `,
    rules: [
        {
            category: 'template-selection',
            items: [
                'Analyze project requirements before selecting template',
                'Default to blank template if no specific requirements match',
                'Consider tech stack preferences if mentioned',
                'Validate template compatibility with user requirements',
                'MUST select blank template if no specific requirements match',
            ]
        }
    ],
    tools: [
        {
            name: 'selectTemplate',
            type: 'action',
            description: 'Selects the most appropriate project template based on requirements',
            label: 'Import Project Template',
            parameters: [
                {
                    name: 'id',
                    type: 'string',
                    description: 'mulst be one of the available templates',
                    example: `${TEMPLATE_LIST[0].name}`
                }
            ],
            execute: async (args) => {
                // import the project template import tool
                // this has to be dynamic since it's also imported in server which does not have the webcontainer
                const {ProjectTemplateImportTool} = await import('../lib/tools/project-template-import');
                let projectImporter=new ProjectTemplateImportTool(webcontainer); 
                let response=await projectImporter.execute(args);
                return response;
            }
        },
    ],
    templateVariables: [
        {
            name: 'availableTemplates',
            type: 'array',
            description: 'List of available project templates with their specifications',
        },
    ]
})
codeTemplateAgent.setTemplateValue('availableTemplates', TEMPLATE_LIST.map(t => {
    return {
        templateId: t.name,
        name: t.label,
    }
}))

let availableAgents: Agent[] = [codeTemplateAgent]

const coordinatorAgent = new Agent({
    agentId: 'coordinator',
    name: 'Coordinator Agent',
    description: 'A coordinator agent that routes queries to appropriate specialized agents and manages clarifications',
    purpose: 'Route user queries to the most suitable agent and request clarification when needed',
    rules: [
        {
            category: 'routing',
            items: [
                'Always analyze user query intent before routing',
                'Route to the most specialized agent for the task',
                // 'Ask for clarification if query intent is ambiguous',
                'Only route to available agents in the provided agent list',
                'MUST ROUTE TO CODE SCAFFOLDING AGENT IF THIS IS A NEW PROJECT OR START OF A NEW DEVELOPMENT',
                'DO NOT ROUTE TO OTHER AGENT IF PROJECT IS INITIALIZED AND CODE GENERATION CAN SOLVE THE PROBLEM',
            ]
        },
        // {
        //     category: 'clarification',
        //     items: [
        //         'Ask specific questions related to ambiguous parts of the query',
        //         'Provide context about why clarification is needed',
        //         'Keep clarification questions concise and focused'
        //     ]
        // },
        {
            category: 'coder generation agent',
            items: [
                'MUST be the default handler for ALL requests',
                'MUST attempt to solve through code generation first',
                'Handles ALL tasks that can be solved through code generation:',
                '    - Writing new code',
                '    - Modifying existing code',
                '    - Generating configurations',
                '    - Creating scripts',
                '    - Defining workflows',
                '    - Writing documentation',
                '    - Installing dependencies',
                '    - Starting development server',
                'MUST ONLY reject requests when:',
                '    - Task explicitly requires system/external actions that cannot be solved with code',
                '    - Task is not solvable through code',
                ]
        },

    ],
    tools: [
        {
            name: 'routeToAgent',
            type: 'action',
            description: 'Routes the current query to the most appropriate agent',
            label: 'Route to Agent',
            parameters: [
                {
                    name: 'agentId',
                    type: 'string',
                    description: 'ID of the agent to route to',
                    example: 'math-agent'
                },
                {
                    name: 'query',
                    type: 'string',
                    description: 'The original or clarified user query',
                    example: 'What is the square root of 16?'
                },
                {
                    name: 'confidence',
                    type: 'number',
                    description: 'Confidence score for this routing decision (0-1)',
                    example: '0.95'
                }
            ],
            execute: async (args) => {
                const selectedAgent = availableAgents.find(agent => agent.getConfig().agentId === args.agentId);
                if (!selectedAgent) {
                    return JSON.stringify({
                        success: false,
                        error: 'Agent not found'
                    });
                }
                return JSON.stringify({
                    success: true,
                    routedTo: args.agentId,
                    confidence: args.confidence
                });
            }
        },
        {
            name: 'routeToDefaultAgent',
            type: 'action',
            description: 'Routes the current query to the default agent',
            label: 'Route to Default Agent',
            parameters: [
                {
                    name: 'confidence',
                    type: 'number',
                    description: 'Confidence score for this routing decision (0-1)',
                    example: '0.95'
                }
            ],
            execute: async (args) => {
                return JSON.stringify({
                    success: true,
                    confidence: args.confidence
                });
            }
        },
        // {
        //     name: 'requestClarification',
        //     type: 'action',
        //     description: 'Requests clarification from the user when query intent is unclear',
        //     label: 'Request Clarification',
        //     parameters: [
        //         {
        //             name: 'question',
        //             type: 'string',
        //             description: 'The clarifying question to ask the user',
        //             example: 'Could you specify whether you need mathematical or statistical analysis?'
        //         }
        //     ],
        //     execute: async (args) => {
        //         return args.question;
        //     }
        // }
    ],
    templateVariables: [
        {
            name: 'availableAgents',
            type: 'array',
            description: 'List of available agents with their capabilities and descriptions'
        },
        {
            name: 'confidenceThreshold',
            type: 'number',
            description: 'Minimum confidence threshold required for routing without clarification'
        }
    ]
});

// Set template values
coordinatorAgent.setTemplateValue('availableAgents', availableAgents.map(agent => {
    return JSON.stringify({
        agentId: agent.getConfig().agentId,
        name: agent.getConfig().name,
        description: agent.getConfig().description,
        purpose: agent.getConfig().purpose,
        capabilities: agent.getTools().map(t => t.label).join(', ')
    }, null, 2)
}).join('\n'));
coordinatorAgent.setTemplateValue('confidenceThreshold', 0.8);

export const prebuiltAgents: { [key: string]: Agent } = {
    coordinatorAgent,
    codeTemplateAgent,
}
export const agentRegistry: { [key: string]: Agent } = Object.keys(prebuiltAgents).reduce((acc, key) => {
    acc[prebuiltAgents[key].getConfig().agentId] = prebuiltAgents[key];
    return acc;
}, {} as { [key: string]: Agent })
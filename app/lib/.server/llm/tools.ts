import { z } from 'zod';
import { tool } from 'ai';
export default {
    SelectCodeTemplate: tool({
        description: `Use this to select one single code template best suited for the user query, 
        Remember: 
        * ASK FOR CONFIRMATION: before opting for a code template, Also mention that you are going to use a template to generate the code.
        * If its best to start from scratch then select "blank" template.
        * ONLY SELECT ONE TEMPLATE AT A TIME.
        * Once template Selection is done you can continue with users initial query. and start working on the codebase`,
        parameters: z.object({
            template: z.enum([
                'blank',
                'vite-react-js',
                'vite-react-ts',
                'vite-svelte',
                'vite-vue',
                'nextjs',
                'vite-react-tailwind',
                'vite-react-shadcn',
                'python']),
        }),
        // execute: async ({ template }) => template,
    }),
    // client-side tool that starts user interaction:
    askForConfirmation: tool({
        description: 'use this to Ask the user for Confirmation.',
        parameters: z.object({
            message: z.string().describe('The message to ask for confirmation.'),
        }),
    }),
}
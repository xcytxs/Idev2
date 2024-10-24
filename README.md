[![Bolt.new: AI-Powered Full-Stack Web Development in the Browser](./public/social_preview_index.jpg)](https://bolt.new)

# Bolt.new Fork by Cole Medin

This enhanced fork of Bolt.new empowers you to choose from a variety of Language Models (LLMs) for each prompt, including OpenAI, Anthropic, Ollama, OpenRouter, Gemini, and Groq. The architecture is designed for easy extension to support any model compatible with the Vercel AI SDK. Detailed instructions for local setup and model integration are provided below.

## Completed Enhancements

- ✅ OpenRouter Integration (@coleam00)
- ✅ Gemini Integration (@jonathands)
- ✅ Automatic Ollama model detection (@yunatamos)
- ✅ Model filtering by provider (@jasonm23)
- ✅ Project download as ZIP (@fabwaseem)

## Roadmap - Contributions Welcome!

- ⬜ LM Studio Integration
- ⬜ DeepSeek API Integration
- ⬜ Together AI Integration
- ⬜ Azure OpenAI API Integration
- ⬜ HuggingFace Integration
- ⬜ Perplexity AI Integration
- ⬜ Docker containerization for simplified deployment
- ⬜ Optimized prompting for smaller LLMs
- ⬜ Image attachment support for prompts
- ⬜ Backend agent execution (replacing single model calls)
- ⬜ Direct GitHub project publishing
- ⬜ One-click deployment to Vercel/Netlify/similar platforms
- ⬜ Local project import functionality
- ⬜ Code version control and rollback feature
- ⬜ Prompt result caching for efficiency
- ⬜ In-UI API key management
- ⬜ Reduced frequency of file rewrites

# Bolt.new: Revolutionizing Full-Stack Web Development in the Browser

Bolt.new is a cutting-edge AI-powered web development platform that enables you to prompt, run, edit, and deploy full-stack applications directly from your browser, eliminating the need for local setup. For those interested in building their own AI-powered web development tools using the Bolt open-source codebase, [start here](./CONTRIBUTING.md).

## Bolt.new's Unique Advantages

While platforms like Claude and GPT-4 excel at code generation, Bolt.new takes it further by providing a complete development environment:

- **Comprehensive Browser-Based Development**: Bolt.new seamlessly integrates state-of-the-art AI models with an in-browser development environment powered by **StackBlitz's WebContainers**, enabling:
  - Installation and execution of npm tools and libraries (e.g., Vite, Next.js)
  - Node.js server runtime
  - Third-party API integration
  - Chat-based production deployment
  - Shareable project URLs

- **AI-Driven Environment Control**: Unlike traditional IDEs where AI assists only in code generation, Bolt.new grants AI models **full control** over the entire development ecosystem, including the filesystem, Node.js server, package manager, terminal, and browser console. This empowers AI agents to manage the complete application lifecycle from inception to deployment.

Bolt.new caters to experienced developers, product managers, and designers alike, facilitating the creation of production-ready full-stack applications with ease.

For developers keen on building their own AI-enhanced development tools using WebContainers, explore the open-source Bolt codebase in this repository!

## Prerequisites

Ensure you have the following installed before proceeding:

- Node.js (v20.15.1 or later)
- pnpm (v9.4.0 or later)

## Setup Instructions

1. Clone the repository (if you haven't already):

```bash
git clone https://github.com/coleam00/bolt.new-any-llm.git
```

2. Install dependencies:

```bash
pnpm install
```

3. Rename `.env.example` to .env.local and add your LLM API keys (you only have to set the ones you want to use and Ollama doesn't need an API key because it runs locally on your computer):

```
GROQ_API_KEY=XXX
OPENAI_API_KEY=XXX
ANTHROPIC_API_KEY=XXX
```

Optionally, you can set the debug level:

```
VITE_LOG_LEVEL=debug
```

**Important**: Never commit your `.env.local` file to version control. It's already included in .gitignore.

## Adding New LLMs:

To make new LLMs available to use in this version of Bolt.new, head on over to `app/utils/constants.ts` and find the constant MODEL_LIST. Each element in this array is an object that has the model ID for the name (get this from the provider's API documentation), a label for the frontend model dropdown, and the provider. 

By default, Anthropic, OpenAI, Groq, and Ollama are implemented as providers, but the YouTube video for this repo covers how to extend this to work with more providers if you wish!

When you add a new model to the MODEL_LIST array, it will immediately be available to use when you run the app locally or reload it. For Ollama models, make sure you have the model installed already before trying to use it here!

## Available Scripts

- `pnpm run dev`: Starts the development server.
- `pnpm run build`: Builds the project.
- `pnpm run start`: Runs the built application locally using Wrangler Pages. This script uses `bindings.sh` to set up necessary bindings so you don't have to duplicate environment variables.
- `pnpm run preview`: Builds the project and then starts it locally, useful for testing the production build. Note, HTTP streaming currently doesn't work as expected with `wrangler pages dev`.
- `pnpm test`: Runs the test suite using Vitest.
- `pnpm run typecheck`: Runs TypeScript type checking.
- `pnpm run typegen`: Generates TypeScript types using Wrangler.
- `pnpm run deploy`: Builds the project and deploys it to Cloudflare Pages.

## Development

To start the development server:

```bash
pnpm run dev
```

This will start the Remix Vite development server. You will need Google Chrome Canary to run this locally! It's an easy install and a good browser for web development anyway.

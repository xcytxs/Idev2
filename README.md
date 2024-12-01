[!IDEV]
Welcome to IDEV, the rebranded and enhanced fork of Bolt.new! This fork allows you to select and use multiple LLMs for each prompt. Supported models include OpenAI, Anthropic, Ollama, OpenRouter, Gemini, LMStudio, Mistral, xAI, HuggingFace, DeepSeek, Groq, and more. It’s easily extendable to accommodate additional models supported by the Vercel AI SDK.

Join our growing IDEV Community to contribute, discuss, and enhance this exciting project!

Features and Integrations
✅ OpenRouter Integration
✅ Gemini Integration
✅ Ollama Autogeneration
✅ Model Filtering by Provider
✅ Download Projects as ZIP
✅ Docker Containerization
✅ GitHub Publishing
✅ API Key UI Integration
✅ HuggingFace, xAI, and Groq Integrations
✅ Code Output Streaming
✅ Revert to Earlier Code Versions
✅ Dynamic Model Token Length Adjustments
⬜ HIGH PRIORITY - Enhanced prompting for smaller LLMs
⬜ HIGH PRIORITY - Mobile-Friendly UI
⬜ HIGH PRIORITY - Better Prompt Caching and Enhancements
⬜ Azure, Perplexity, and Vertex AI Integrations
For the complete roadmap, visit IDEV Roadmap.

Why IDEV Stands Out
AI-Driven Full-Stack Development in the Browser
IDEV transforms web development by integrating cutting-edge AI with an in-browser IDE powered by StackBlitz’s WebContainers. Features include:

Full-Stack Capabilities: Install, run, and manage Node.js servers, npm libraries, and third-party APIs directly in your browser.
End-to-End Environment Control: Empower AI to handle the app lifecycle—scaffolding, debugging, deploying—all from the same interface.
Whether you're a developer, PM, or designer, IDEV offers a seamless, production-grade development experience.

Getting Started
Prerequisites
Git: Download Git
Node.js: Download Node.js
Docker (for containerized deployment): Install Docker
Installation
Clone the repository:

bash
Copy code
git clone https://github.com/idev-cloud/idev-any-llm.git
Set up environment variables:

Rename .env.example to .env.local.
Add API keys for models you'd like to use:
env
Copy code
GROQ_API_KEY=XXX
OPENAI_API_KEY=XXX
ANTHROPIC_API_KEY=XXX
Install dependencies:

bash
Copy code
pnpm install
Start the development server:

bash
Copy code
pnpm run dev


Running IDEV
With Docker
Build the Container:

bash
Copy code
npm run dockerbuild   # Development  
npm run dockerbuild:prod   # Production  
Run with Docker Compose:

bash
Copy code
docker-compose --profile development up   # Development  
docker-compose --profile production up   # Production  
Without Docker
Install Dependencies:

bash
Copy code
pnpm install  
Start the App:

bash
Copy code
pnpm run dev  
Contribute to IDEV
Your contributions are welcome! Check the CONTRIBUTING.md for details. Let's build the future of AI-driven development together.

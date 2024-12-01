# Contribution Guidelines

## DEFAULT_NUM_CTX

The `DEFAULT_NUM_CTX` environment variable can be used to limit the maximum number of context values used by the qwen2.5-coder model. For example, to limit the context to 24576 values (which uses 32GB of VRAM), set `DEFAULT_NUM_CTX=24576` in your `.env.local` file.

First off, thank you for considering contributing to Bolt.new! This fork aims to expand the capabilities of the original project by integrating multiple LLM providers and enhancing functionality. Every contribution helps make Bolt.new a better tool for developers worldwide.

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Development Setup](#development-setup)
- [Deploymnt with Docker](#docker-deployment-documentation)
- [Model Providers](#model-providers)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### 🐞 Reporting Bugs and Feature Requests
- Check the issue tracker to avoid duplicates
- Use the issue templates when available
- Include as much relevant information as possible
- For bugs, add steps to reproduce the issue

### 🔧 Code Contributions
1. Fork the repository
2. Create a new branch for your feature/fix
3. Write your code
4. Submit a pull request

### ✨ Becoming a Core Contributor
We're looking for dedicated contributors to help maintain and grow this project. If you're interested in becoming a core contributor, please fill out our [Contributor Application Form](https://forms.gle/TBSteXSDCtBDwr5m7).

## Pull Request Guidelines

### 📝 PR Checklist
- [ ] Branch from the main branch
- [ ] Update documentation if needed
- [ ] Manually verify all new functionality works as expected
- [ ] Keep PRs focused and atomic

### 👀 Review Process
1. Manually test the changes
2. At least one maintainer review required
3. Address all review comments
4. Maintain clean commit history

## Coding Standards

### 💻 General Guidelines
- Follow existing code style
- Comment complex logic
- Keep functions focused and small
- Use meaningful variable names

## Development Setup

### 🔄 Initial Setup
1. Clone the repository:
```bash
git clone https://github.com/coleam00/bolt.new-any-llm.git
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
   - Rename `.env.example` to `.env.local`
   - Add your LLM API keys (only set the ones you plan to use):
```bash
GROQ_API_KEY=XXX
HuggingFace_API_KEY=XXX
OPENAI_API_KEY=XXX
ANTHROPIC_API_KEY=XXX
...
```
   - Optionally set debug level:
```bash
VITE_LOG_LEVEL=debug
```

   - Optionally set context size:
```bash
DEFAULT_NUM_CTX=32768
```

Some Example Context Values for the qwen2.5-coder:32b models are.
 
* DEFAULT_NUM_CTX=32768 - Consumes 36GB of VRAM
* DEFAULT_NUM_CTX=24576 - Consumes 32GB of VRAM
* DEFAULT_NUM_CTX=12288 - Consumes 26GB of VRAM
* DEFAULT_NUM_CTX=6144 - Consumes 24GB of VRAM

**Important**: Never commit your `.env.local` file to version control. It's already included in .gitignore.

### 🚀 Running the Development Server
```bash
pnpm run dev
```

**Note**: You will need Google Chrome Canary to run this locally if you use Chrome! It's an easy install and a good browser for web development anyway.

## Testing

Run the test suite with:

```bash
pnpm test
```

## Deployment

To deploy the application to Cloudflare Pages:

```bash
pnpm run deploy
```

Make sure you have the necessary permissions and Wrangler is correctly configured for your Cloudflare account.

## Model Providers

### GitHub Models Provider by @ThePsyberSleuth

The GitHub Models provider integrates a comprehensive suite of AI models through Azure ML endpoints, offering access to cutting-edge models from various providers. This integration enables developers to leverage powerful language models while maintaining compatibility with existing OpenAI-style interfaces.

#### Setup Requirements

1. Obtain a GitHub API Key from https://github.com/settings/tokens
2. Add the key to your `.env.local`:
   ```bash
   GITHUB_API_KEY=your_key_here
   ```

#### Available Models

1. O1 Series
   - O1 Preview (Latest cutting-edge model)
   - O1 Mini (Efficient, smaller model)

2. Meta Llama Series
   - Llama 3.1 405B Instruct
   - Llama 3.1 70B Instruct
   - Llama 3.1 8B Instruct

3. Mistral Series
   - Mistral Large
   - Mistral Medium
   - Mistral Small

4. GPT-4O Series
   - GPT-4O Advanced
   - GPT-4O Standard

5. Phi Series
   - Phi-2
   - Phi-1.5

#### Usage Example

```typescript
// Initialize the model
const model = getModel('GitHub Models', 'mistral-large', env);

// Use the model
const response = await model.chat([
  { role: 'system', content: 'You are a helpful AI assistant.' },
  { role: 'user', content: 'Hello!' }
]);
```

#### Configuration Options

- Context Window: Configurable through `DEFAULT_NUM_CTX`
- Temperature: Adjustable per request
- Response Format: Supports both streaming and non-streaming responses

## Docker Deployment Documentation

This guide outlines various methods for building and deploying the application using Docker.

## Build Methods

### 1. Using Helper Scripts

NPM scripts are provided for convenient building:

```bash
# Development build
npm run dockerbuild

# Production build
npm run dockerbuild:prod
```

### 2. Direct Docker Build Commands

You can use Docker's target feature to specify the build environment:

```bash
# Development build
docker build . --target bolt-ai-development

# Production build
docker build . --target bolt-ai-production
```

### 3. Docker Compose with Profiles

Use Docker Compose profiles to manage different environments:

```bash
# Development environment
docker-compose --profile development up

# Production environment
docker-compose --profile production up
```

## Running the Application

After building using any of the methods above, run the container with:

```bash
# Development
docker run -p 5173:5173 --env-file .env.local bolt-ai:development

# Production
docker run -p 5173:5173 --env-file .env.local bolt-ai:production
```

## Deployment with Coolify

[Coolify](https://github.com/coollabsio/coolify) provides a straightforward deployment process:

1. Import your Git repository as a new project
2. Select your target environment (development/production)
3. Choose "Docker Compose" as the Build Pack
4. Configure deployment domains
5. Set the custom start command:
   ```bash
   docker compose --profile production up
   ```
6. Configure environment variables
   - Add necessary AI API keys
   - Adjust other environment variables as needed
7. Deploy the application

## VS Code Integration

The `docker-compose.yaml` configuration is compatible with VS Code dev containers:

1. Open the command palette in VS Code
2. Select the dev container configuration
3. Choose the "development" profile from the context menu

## Environment Files

Ensure you have the appropriate `.env.local` file configured before running the containers. This file should contain:
- API keys
- Environment-specific configurations
- Other required environment variables

## Notes

- Port 5173 is exposed and mapped for both development and production environments
- Environment variables are loaded from `.env.local`
- Different profiles (development/production) can be used for different deployment scenarios
- The configuration supports both local development and production deployment

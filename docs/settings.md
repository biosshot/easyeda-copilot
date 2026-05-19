# Settings

EasyEDA Copilot can work with multiple LLM providers. Configure providers, API keys, context behavior and agent-specific models in `Settings`.

## Connecting providers

The standard provider list includes:

- **OpenAI**: GPT models.
- **OpenRouter**: access to multiple model providers through one platform.
- **Anthropic**: Claude models.
- **DeepSeek**: DeepSeek models.
- **Ollama (cloud)**: cloud access for Ollama-style deployments.
- **ZAI**: ZAI service support.
- **Moonshot (Kimi)**: Moonshot/Kimi models.
- **Local (Beta)**: local model deployment through relay.

To connect a provider:

1. Select a provider in `Settings -> API Provider`.
2. Enter the provider `API Key`.
3. Configure `Tavily API Key` if you need web search for a provider without built-in search.

OpenAI and Anthropic have built-in web search support, so Tavily is optional for them. For providers without built-in web search, web search will not work unless Tavily is configured.

## Advanced settings

### Base URL

`Base URL` overrides the standard API endpoint. Leave it empty to use the provider's default endpoint.

This is useful for OpenAI-compatible APIs, gateways or proxies.

Local addresses such as `localhost` and `127.0.0.1` work only with the **Local (Beta)** provider. They do not work with other providers.

### Tavily API Key

`Tavily API Key` enables web search for providers without built-in web search, such as DeepSeek, ZAI or Moonshot.

### Max Tool Parallel

`Max Tool Parallel` controls how many tools or sub-agents can run at the same time.

- Range: `1` to `25`.
- Default: `8`.
- Decrease it if you hit provider limits or local resource constraints.

### Context management

Context management controls how Copilot handles long conversations and token usage:

- **Summarization**: automatically summarizes older messages.
- **Disable**: disables context compression.
- **Trimming**: removes older messages when the context limit is exceeded.

## Agents

Each specialized agent can be configured separately:

- **Model**: model used by this agent.
- **Reasoning**: reasoning level for models that support it.
- **Additional tools**: optional tools available to the agent.

If an agent has no model configured, it uses the Base Agent model. If the Base Agent model is also not configured, OpenAI models are used by default.

### Base Agent

Universal fallback agent for specialized agents without their own model.

Recommended capabilities: JSON, tools, image processing.

The `Apply to all` button copies Base Agent settings to all specialized agents.

### Block Diagram

Creates structural diagrams, system architectures and visual block representations.

Recommended capabilities: tools, JSON.

### Chat

Handles general conversation, contextual requests and iterative design discussion.

Recommended capabilities: tools.

### Circuit Explainer

Analyzes and explains circuit functionality, signal flow and component interaction.

Recommended capabilities: vision/image processing.

Additional option:

- **Add spice-simulation to agent tools**: enables SPICE simulation and result display support.

### Circuit Maker

Creates new circuits and modifies existing ones.

Recommended capabilities: tools, JSON.

Additional option:

- **Add reused block to agent tools (Beta)**: allows the agent to use reusable standard blocks when generating circuits.

### Completions

Collects and processes completion options during autocomplete.

Recommended capabilities: tools, JSON.

### List Completions

Generates lists of possible options for additions and autocomplete.

Recommended capabilities: JSON.

### Diagnostic Algorithms

Generates troubleshooting procedures, test sequences and workflows.

Recommended capabilities: tools, JSON.

### Pin Descriptions

Determines correct pin names and functions when the LCSC catalog only lists pin numbers.

Recommended capabilities: JSON, image processing.

### LCSC Component Search

Translates design requirements into precise LCSC catalog queries and filters results.

Recommended capabilities: JSON, tools.

Additional option:

- **Performs a preliminary web search**: searches the web before querying the catalog to refine component parameters.

### LCSC Catalog Matcher

Identifies the most relevant catalogs for complex component search.

Recommended capabilities: JSON.

## Recommendations

1. Use stronger models for agents that require high accuracy, such as Circuit Maker and Circuit Explainer.
2. Use faster and cheaper models for Chat and List Completions if latency and cost matter.
3. Use the Local provider for local deployment workflows.
4. Configure Tavily if your selected provider does not include built-in web search.

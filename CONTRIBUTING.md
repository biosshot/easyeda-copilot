# Contributing to easyeda-copilot

Thanks for your interest in the project! Bug reports, ideas, documentation updates, and code contributions are welcome.

## Setup

```bash
git clone https://github.com/biosshot/eda-copilot-backend.git
git clone https://github.com/biosshot/eda-copilot-router.git copilot-router
git clone https://github.com/biosshot/easyeda-copilot.git
cd easyeda-copilot
npm ci
```

Set the mode in `shared/mode.ts`:

```ts
export const __MODE__: string = 'PROD';
```

`PROD` selects the hosted services for the legacy built-in interface. MCP uses the local `eda-copilot-backend` and `eda-copilot-router` packages; it does not require the legacy Copilot server or its API keys.

## EasyEDA extension

Start the development environment:

```bash
npm run dev
```

Build the extension:

```bash
npm run build
```

The extension package will be created in `build/dist`.

## MCP server

The default checkout uses published backend/router packages. Run `npm run check --workspace=mcp` without sibling repositories or Rust. Developing these libraries together is optional; clone and prepare them as follows (Rust and a platform C/C++ toolchain are required):

```bash
git clone https://github.com/biosshot/eda-copilot-backend.git ../eda-copilot-backend
git clone https://github.com/biosshot/eda-copilot-router.git ../copilot-router
npm --prefix ../eda-copilot-backend ci
npm --prefix ../eda-copilot-backend run native:build
npm --prefix ../copilot-router ci
npm run deps:local
npm run check --workspace=mcp
```

Build and open MCP Inspector:

```bash
npm run inspect --workspace=mcp
```

To test tools that communicate with EasyEDA, start EasyEDA Desktop and enable `External Interactions` for the EasyEDA Copilot extension.

For dependency switching and release checks, follow [local development](docs/local-development.md). For router-specific diagnostics, see [local router integration](docs/local-router.md). Use [the documentation map](docs/README.md) to distinguish current MCP instructions from legacy UI guides. The LLM routing reference and the router package reference are maintained separately; review relevant API changes when updating the dependency.

## Pull requests

1. Create a branch.
2. Make your changes.
3. Run the relevant build or MCP check.
4. Open a pull request and briefly describe the change.

If possible, keep each pull request focused on one issue.

## Issues

Feel free to open an issue for a bug, feature request, documentation improvement, or question.

## License

Contributions are licensed under the MIT License.

# Contributing to easyeda-copilot

Thanks for your interest in the project! Bug reports, ideas, documentation updates, and code contributions are welcome.

## Setup

```bash
git clone https://github.com/biosshot/easyeda-copilot.git
cd easyeda-copilot
npm install
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

Build the local backend first, then check types, build MCP and run its integration checks. The native build requires Rust when a matching binary has not already been built:

```bash
npm run native:build --workspace=eda-copilot-backend
npm run build --workspace=eda-copilot-backend
npm run check --workspace=mcp
```

Build and open MCP Inspector:

```bash
npm run inspect --workspace=mcp
```

To test tools that communicate with EasyEDA, start EasyEDA Desktop and enable `External Interactions` for the EasyEDA Copilot extension.

For an unpublished router checkout, follow [local router integration](docs/local-router.md). Use [the documentation map](docs/README.md) to distinguish current MCP instructions from legacy UI guides. The LLM routing reference and the router package reference are maintained separately; review relevant API changes when updating the dependency.

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

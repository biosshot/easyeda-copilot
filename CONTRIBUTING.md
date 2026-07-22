# Contributing to easyeda-copilot

Thanks for your interest in the project! Bug reports, ideas, documentation updates, and code contributions are welcome.

## Setup

```bash
git clone https://github.com/biosshot/easyeda-copilot.git
cd easyeda-copilot
npm install
```

Set the mode in `packages/shared/mode.ts`:

```ts
export const __MODE__: string = 'PROD';
```

`PROD` is currently required because the project uses a shared server.

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

Check types and build the MCP server:

```bash
cd mcp
npm run check
```

Build and open MCP Inspector:

```bash
npm run inspect
```

To test tools that communicate with EasyEDA, start EasyEDA Desktop and enable `External Interactions` for the EasyEDA Copilot extension.

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

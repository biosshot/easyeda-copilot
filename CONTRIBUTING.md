# Contributing to easyeda-copilot

Thanks for your interest in contributing!  
Bug reports, ideas, and code contributions are all welcome.

## Local Setup

1. Clone the repository:
```bash
git clone https://github.com/biosshot/easyeda-copilot.git
cd easyeda-copilot
````

2. Install dependencies:

```bash
npm install
```

3. Set the mode in `web/src/mode.ts`:

```ts
export const __MODE__: string = 'PROD';
```

> Note: `PROD` is currently required because the project uses a shared server. Local backend support is not available yet.

1. Start development (browser):

```bash
npm run dev
```

> Some features may be limited in browser mode.

5. Build the extension:

```bash
npm run build
```

The build output will be available at:

```bash
build/dist/easyeda-copilot_v{version}.eext
```

Upload this file into EasyEDA Pro to use the extension.

## Contributing

1. Create a new branch
2. Make your changes
3. Ensure the project builds successfully
4. Open a Pull Request with a clear description

## Issues

Use issues for:

* Bug reports
* Feature requests
* Questions

## Testing

There are currently no automated tests.
Please test your changes manually when possible.

## Pull Requests

Please include:

* A clear description of the changes
* Related issue (if applicable)

---

Thanks for contributing ❤️

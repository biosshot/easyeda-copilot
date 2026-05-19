# Attaching circuits to an AI agent

EasyEDA Copilot can attach circuit data from the EasyEDA Pro editor to the AI agent. This lets the agent inspect or modify the current schematic context.

## Upload options

Use one of the available circuit upload actions:

- **Upload selected**: attaches only the circuit elements currently selected in the EasyEDA Pro editor.
- **Upload all**: attaches the entire circuit on the currently open EasyEDA Pro page.

Use `Upload selected` when you want the agent to focus on a specific fragment. Use `Upload all` when the agent needs the full schematic context.

## Important limitation

A full EasyEDA project cannot be attached at once. Copilot can attach individual circuits or selected elements from the current editor page only.

## Recommended workflow

1. Open the circuit page you want the agent to inspect.
2. Select the relevant elements if the task is local to one fragment.
3. Use `Upload selected` or `Upload all`.
4. Ask the agent a focused question or request a specific modification.

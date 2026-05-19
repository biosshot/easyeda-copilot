# Assembling a circuit from an AI agent

The AI agent can prepare a circuit result that can be assembled back into EasyEDA Pro. The assembly buttons appear only when the agent has completed the required circuit-making workflow.

## Required agent workflow

For the user to assemble a generated circuit and apply changes, the AI agent must:

1. Load the `circuit_maker` skill.
2. Find the required components.
3. Assemble the final circuit.
4. Export the result using the output format provided by `circuit_maker`.

If these steps are not completed, the interface will not show the assembly action.

## Where assembly appears in the UI

When the workflow is completed successfully, the user can assemble the circuit from:

- the inline `Assemble circuit` button above the prompt input line;
- the `Assemble circuit` button inside the AI agent message.

## When the button is missing

If the assembly button does not appear, the most likely reason is that the agent did not produce a valid circuit assembly result. Ask the agent to generate or fix the circuit using the circuit-making workflow, then wait for a message that includes the assembled circuit result.

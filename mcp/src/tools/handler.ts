import { TIMEOUT_POLICY } from '@copilot/shared/timeout-policy';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Bridge } from '../bridge';
import { abortable, withExecutionSignal, withTarget } from '../operations/cancellation';
import { operationManager } from '../operations/manager';
import { operationToolResult } from '../operations/tool-result';
import { captureTarget } from '../operations/target';
import { MCP_VERSION } from '../utils/dirs';

type ToolHandler = (...args: any[]) => CallToolResult | Promise<CallToolResult>;

/** Add the MCP request signal and the extension-version warning to one explicit tool handler. */
export function toolHandler(bridge: Bridge, handler: ToolHandler): ToolHandler {
    return async (...args: any[]) => {
        const extra = args[args.length - 1] as { signal: AbortSignal };
        const result = await withExecutionSignal(
            extra.signal,
            () => abortable(Promise.resolve(handler(...args)), extra.signal),
        );
        extra.signal.throwIfAborted();
        const warning = await bridge.getVersionWarning(MCP_VERSION);
        if (warning && Array.isArray(result.content)) result.content.push({ type: 'text', text: warning });
        return result;
    };
}

/** Pin an existing self-managed operation to the EasyEDA instance/document selected at invocation. */
export function targetedToolHandler(bridge: Bridge, handler: ToolHandler): ToolHandler {
    return toolHandler(bridge, async (...args: any[]) => {
        const target = await captureTarget(bridge);
        return withTarget(target, () => handler(...args));
    });
}

/** Run one explicitly declared document mutation through Operation Manager. */
export function managedMutationHandler(bridge: Bridge, tool: string, handler: ToolHandler): ToolHandler {
    return toolHandler(bridge, async (...args: any[]) => {
        const requestExtra = args[args.length - 1] as { signal: AbortSignal };
        const target = await captureTarget(bridge);
        const id = operationManager.start('mutation', async context => {
            const operationArgs = [...args];
            operationArgs[operationArgs.length - 1] = { ...requestExtra, signal: context.signal };
            const result = await handler(...operationArgs);
            return { operation_id: context.id, tool_result: result };
        }, { target, tool, initialStage: 'executing' });
        return operationToolResult(await operationManager.wait(id, TIMEOUT_POLICY.mutationWaitMs));
    });
}

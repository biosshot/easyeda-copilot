import { EXECUTE_JS_TIMEOUT_MS } from '@copilot/shared/types/execute-js';

export const MCP_TIMEOUT_MESSAGE = 'Execution timed out. Already-started actions may still complete; do not automatically retry changes.';

const LONG_RUNNING_EVENTS = new Set([
    'assemble-circuit', 'beautify-current-page', 'assemble-board',
    'export-routing-input', 'apply-routing-result',
]);

export function mcpCommandTimeoutMs(event: string, deadlineAt?: unknown, now = Date.now()) {
    const limit = event === 'execute-js' ? EXECUTE_JS_TIMEOUT_MS
        : LONG_RUNNING_EVENTS.has(event) ? 300_000 : 120_000;
    return typeof deadlineAt === 'number' && Number.isFinite(deadlineAt)
        ? Math.max(0, Math.min(limit, deadlineAt - now)) : limit;
}

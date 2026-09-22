import { commandTimeoutMs } from '@copilot/shared/timeout-policy';

export const MCP_TIMEOUT_MESSAGE = 'Execution timed out. Already-started actions may still complete; do not automatically retry changes.';

export function mcpCommandTimeoutMs(event: string, deadlineAt?: unknown, now = Date.now()) {
    const limit = commandTimeoutMs(event);
    return typeof deadlineAt === 'number' && Number.isFinite(deadlineAt)
        ? Math.max(0, Math.min(limit, deadlineAt - now)) : limit;
}

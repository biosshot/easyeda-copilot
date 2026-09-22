/** Command budgets only; native-call and connection/heartbeat timeouts stay local.
 * Deadlines still include queue waiting. This policy does not change cancellation.
 */
export const TIMEOUT_POLICY = {
    commandMs: 120_000,
    executeJsMs: 60_000,
    longCommandMs: 300_000,
    proxyResponseGraceMs: 1_000,
    cliRequestMs: 10 * 60_000,
    operationWaitMs: 30_000,
    operationWaitMaxMs: 55_000,
    routerExecutionMs: 60 * 60_000,
} as const;

const LONG_RUNNING_EVENTS = new Set([
    'assemble-circuit', 'beautify-current-page', 'assemble-board',
    'export-routing-input', 'apply-routing-result',
    'check-pcb-drc', 'inspect-net', 'inspect-component',
    'annotate-designators', 'import-pcb-changes', 'sync-current-document',
]);

/** Shared default for MCP requests and the extension command watchdog. */
export function commandTimeoutMs(event: string): number {
    if (event === 'execute-js') return TIMEOUT_POLICY.executeJsMs;
    return LONG_RUNNING_EVENTS.has(event) ? TIMEOUT_POLICY.longCommandMs : TIMEOUT_POLICY.commandMs;
}

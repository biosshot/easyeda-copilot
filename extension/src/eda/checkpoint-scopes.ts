import { executeJavaScript } from './execute-js';
import type { ExecuteJsWireResult } from '@copilot/shared/types/execute-js';

type Store = {
    save(minor: boolean, name?: string): Promise<string | null>;
    pin(id: string, expiresAt: number): void;
    unpin(id: string): void;
};
type Scope = { token: string; sessionId: string; documentUuid: string; checkpointId: string; expiresAt: number };

/** Called only in the existing serial editor queue. Tokens are per logical SDK session. */
export class CheckpointScopes {
    private scopes = new Map<string, Scope>();
    private epoch: number | undefined;
    constructor(private store: Store, private now = Date.now, private token = () => crypto.randomUUID(),
        private ttlMs = 5 * 60_000) {}

    private sweep(epoch: number) {
        for (const [token, scope] of this.scopes) {
            if (epoch !== this.epoch || scope.expiresAt <= this.now()) {
                this.store.unpin(scope.checkpointId);
                this.scopes.delete(token);
            }
        }
        this.epoch = epoch;
    }

    async execute(body: { code: string; inputs?: Record<string, string>; checkpointScope?: unknown }, api: any, epoch: number): Promise<ExecuteJsWireResult> {
        this.sweep(epoch);
        const raw = body.checkpointScope;
        if (raw === undefined) return executeJavaScript(body.code, api, () => this.store.save(false, 'Before JavaScript execution'), body.inputs);
        let scope: Scope | undefined;
        try {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid checkpoint scope request');
            const request = raw as Record<string, unknown>;
            if (typeof request.sessionId !== 'string' || !request.sessionId || request.sessionId.length > 200) throw Error('Invalid checkpoint scope session');
            if (request.action === 'begin') {
                if (typeof request.documentUuid !== 'string' || !request.documentUuid) throw Error('Checkpoint scope requires a bound document');
                if (typeof request.name !== 'string' || !request.name.trim() || request.name.trim().length > 200) throw Error('Checkpoint scope name must contain 1 to 200 characters');
                if ([...this.scopes.values()].some(s => s.sessionId === request.sessionId)) throw Error('Nested checkpoint scopes are unsupported');
                if (this.scopes.size >= 256) throw Error('Too many active checkpoint scopes');
                const doc = await api.dmt_SelectControl.getCurrentDocumentInfo();
                if (doc?.uuid !== request.documentUuid) throw Error('Checkpoint scope document is not active');
                const checkpointId = await this.store.save(false, request.name.trim());
                if (!checkpointId) throw Error('Could not create checkpoint scope baseline');
                scope = { token: this.token(), sessionId: request.sessionId, documentUuid: request.documentUuid, checkpointId, expiresAt: this.now() + this.ttlMs };
                this.scopes.set(scope.token, scope);
                this.store.pin(checkpointId, scope.expiresAt);
                if ((await api.dmt_SelectControl.getCurrentDocumentInfo())?.uuid !== scope.documentUuid) {
                    this.scopes.delete(scope.token); this.store.unpin(checkpointId);
                    throw Error('Document changed while creating checkpoint scope');
                }
                return { checkpoint: checkpointId, result: { kind: 'json', json: 'null' }, checkpointScope: { ...scope } };
            }
            if (!['use', 'end'].includes(String(request.action))) throw Error('Invalid checkpoint scope action');
            scope = typeof request.token === 'string' ? this.scopes.get(request.token) : undefined;
            if (!scope || scope.sessionId !== request.sessionId) {
                scope = undefined;
                throw Error('Checkpoint scope is invalid, expired or belongs to another session');
            }
            if (request.action === 'end') {
                this.scopes.delete(scope.token); this.store.unpin(scope.checkpointId);
                return { checkpoint: scope.checkpointId, result: { kind: 'json', json: 'null' } };
            }
            if ((await api.dmt_SelectControl.getCurrentDocumentInfo())?.uuid !== scope.documentUuid) throw Error('Checkpoint scope document changed');
            scope.expiresAt = this.now() + this.ttlMs;
            this.store.pin(scope.checkpointId, scope.expiresAt);
            const result = await executeJavaScript(body.code, api, async () => scope!.checkpointId, body.inputs);
            if ((await api.dmt_SelectControl.getCurrentDocumentInfo())?.uuid !== scope.documentUuid && !result.error) {
                return { checkpoint: scope.checkpointId, result: null, error: { phase: 'execute', message: 'Checkpoint scope document changed during execution; changes may remain' } };
            }
            return result;
        } catch (error) {
            return { checkpoint: scope?.checkpointId ?? null, result: null, error: { phase: 'checkpoint', message: error instanceof Error ? error.message : String(error) } };
        }
    }
}

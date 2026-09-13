/** Private JSON-lines adapter: Python uses the same Node transport and runtime. */
import { createInterface } from 'node:readline';
import { connect, encode, listInstances, type Session, type CheckpointScope } from './index';

let session: Session | undefined;
let scope: CheckpointScope | undefined;
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let tail = Promise.resolve();
input.on('line', line => {
    tail = tail.then(async () => {
        let request: any;
        try {
            request = JSON.parse(line);
            let result: unknown;
            switch (request.method) {
                case 'list': result = await listInstances(request.params); break;
                case 'connect':
                    if (session) throw Error('Already connected');
                    session = await connect(request.params);
                    result = { sessionId: session.id, instanceId: session.instanceId, documentUuid: session.documentUuid };
                    break;
                case 'packet':
                    if (!session) throw Error('Not connected');
                    result = await session.request(request.params); break;
                case 'executeJs':
                    if (!session) throw Error('Not connected');
                    result = await encode(await session.executeJs(request.params), session); break;
                case 'close': await session?.close(); result = null; break;
                case 'beginCheckpointScope':
                    if (!session) throw Error('Not connected');
                    scope = await session.beginCheckpointScope(request.params.name);
                    result = { checkpointId: scope.checkpointId }; break;
                case 'endCheckpointScope': await scope?.close(); scope = undefined; result = null; break;
                default: throw Error('Unknown SDK worker command');
            }
            process.stdout.write(JSON.stringify({ id: request.id, result, checkpoint: session?.lastCheckpoint }) + '\n');
        } catch (error: any) {
            process.stdout.write(JSON.stringify({ id: request?.id, error: { message: String(error.message ?? error),
                checkpoint: error.checkpoint, outcomeUnknown: error.outcomeUnknown ?? false, failedIndex: error.failedIndex } }) + '\n');
        }
    });
});
input.on('close', () => { void tail.finally(async () => { await session?.close().catch(() => undefined); }); });

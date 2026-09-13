/** Sent as source to the unchanged execute-js handler. Keep this function self-contained. */
export async function remoteRuntime(eda: any, packet: any): Promise<any> {
    const key = '__easyedaCopilotLocalSdkV1';
    const globals = globalThis as any;
    const root: Map<string, any> = globals[key] ??= new Map();
    const now = Date.now();
    for (const [id, entry] of root) if (now - entry.touched > 30 * 60_000) root.delete(id);
    const doc = async () => (await eda.dmt_SelectControl.getCurrentDocumentInfo())?.uuid ?? null;
    if (packet.action === 'init') {
        const current = await doc();
        const expected = packet.documentUuid === undefined ? current : packet.documentUuid;
        if (expected !== null && current !== expected) throw Error('SDK target document is not active');
        root.set(packet.sessionId, { touched: now, documentUuid: expected, objects: new Map(), ids: new WeakMap(), calls: new Map(), next: 0 });
        return { documentUuid: expected };
    }
    if (packet.action === 'close') { root.delete(packet.sessionId); return null; }
    const state = root.get(packet.sessionId);
    if (!state) throw Error('SDK session expired; reconnect and obtain new objects');
    state.touched = now;
    async function assertDocument() {
        if (state.documentUuid !== null && await doc() !== state.documentUuid) {
            root.delete(packet.sessionId);
            throw Error('SDK document changed; session invalidated');
        }
    }
    await assertDocument();
    function reference(value: any) {
        let id = state.ids.get(value);
        if (!id || !state.objects.has(id)) {
            if (state.objects.size >= 50_000) throw Error('SDK object limit reached; release objects or close the session');
            id = String(++state.next); state.ids.set(value, id); state.objects.set(id, value);
        }
        return { t: 'ref', id, sessionId: packet.sessionId };
    }
    function b64(bytes: Uint8Array) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const chunks: string[] = []; let chunk = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
            chunk += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]
                + (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=')
                + (i + 2 < bytes.length ? alphabet[c & 63] : '=');
            if (chunk.length >= 32768) { chunks.push(chunk); chunk = ''; }
        }
        chunks.push(chunk); return chunks.join('');
    }
    function unbase64(s: string) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const out = new Uint8Array(s.length / 4 * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0));
        let k = 0;
        for (let i = 0; i < s.length; i += 4) {
            const n = alphabet.indexOf(s[i]) << 18 | alphabet.indexOf(s[i + 1]) << 12
                | Math.max(0, alphabet.indexOf(s[i + 2])) << 6 | Math.max(0, alphabet.indexOf(s[i + 3]));
            if (k < out.length) out[k++] = n >> 16;
            if (k < out.length) out[k++] = n >> 8;
            if (k < out.length) out[k++] = n;
        }
        return out;
    }
    const binaryTypes = ['ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];
    async function encode(value: any, seen = new Set<any>()): Promise<any> {
        if (value === undefined) return { t: 'undefined' };
        if (typeof value === 'bigint') return { t: 'bigint', value: String(value) };
        if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) return { t: 'number', value: Object.is(value, -0) ? '-0' : String(value) };
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return { t: 'value', value };
        const type = Object.prototype.toString.call(value).slice(8, -1);
        if (type === 'Blob' || type === 'File') return { t: 'binary', type, mime: value.type, name: value.name,
            lastModified: value.lastModified, data: b64(new Uint8Array(await value.arrayBuffer())) };
        if (binaryTypes.includes(type)) {
            const bytes = type === 'ArrayBuffer' ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            return { t: 'binary', type, data: b64(bytes) };
        }
        if (type === 'Date') return { t: 'date', value: value.toISOString() };
        if (seen.has(value)) return reference(value);
        seen.add(value);
        try {
            if (Array.isArray(value)) return { t: 'array', value: await Promise.all(Array.from(value, v => encode(v, new Set(seen)))) };
            const proto = Object.getPrototypeOf(value);
            if (typeof value === 'object' && (proto === null || proto === Object.prototype)
                && !Object.values(Object.getOwnPropertyDescriptors(value)).some(d => d.get || d.set || typeof d.value === 'function')) {
                const entries = [];
                for (const [k, v] of Object.entries(value)) entries.push([k, await encode(v, seen)]);
                return { t: 'object', value: entries };
            }
            return reference(value);
        } finally { seen.delete(value); }
    }
    async function decode(value: any): Promise<any> {
        switch (value.t) {
            case 'value': return value.value;
            case 'undefined': return undefined;
            case 'bigint': return BigInt(value.value);
            case 'number': return Number(value.value);
            case 'date': return new Date(value.value);
            case 'expr': return evaluate(value.value);
            case 'array': return decodeList(value.value);
            case 'object': {
                const entries = [];
                for (const [key, item] of value.value) entries.push([key, await decode(item)]);
                return Object.fromEntries(entries);
            }
            case 'binary': {
                const bytes = unbase64(value.data);
                if (value.type === 'Blob') return new Blob([bytes], { type: value.mime });
                if (value.type === 'File') return new File([bytes], value.name, { type: value.mime, lastModified: value.lastModified });
                if (!binaryTypes.includes(value.type)) throw Error('Unsupported SDK binary type');
                if (value.type === 'ArrayBuffer') return bytes.buffer;
                return new globals[value.type](bytes.buffer);
            }
            default: throw Error('Invalid SDK argument');
        }
    }
    async function decodeList(values: any[]) {
        const result = [];
        // Arguments may contain lazy native mutations. Preserve evaluation order and stop on failure.
        for (const value of values) result.push(await decode(value));
        return result;
    }
    // Expressions may be passed as arguments or chained after their first await.
    // Retain their result across batches so a create/modify expression never runs twice.
    const cache: Map<string, Promise<any>> = state.calls;
    function property(target: any, name: string | number) {
        if (['__proto__', 'prototype', 'constructor'].includes(String(name))) throw Error('Reserved SDK property');
        return target[name];
    }
    async function evaluate(expr: any): Promise<any> {
        if (expr.k === 'root') return eda;
        if (expr.k === 'ref') {
            if (expr.sessionId !== packet.sessionId || !state.objects.has(expr.id)) throw Error('SDK object reference expired or belongs to another session');
            return state.objects.get(expr.id);
        }
        if (expr.k === 'get') return property(await evaluate(expr.target), expr.key);
        if (expr.k === 'call') {
            if (cache.has(expr.id)) return cache.get(expr.id);
            if (cache.size >= 50_000) throw Error('SDK call limit reached; close the session and reconnect');
            const promise = (async () => {
                const receiver = expr.target.k === 'get' ? await evaluate(expr.target.target) : undefined;
                const fn = expr.target.k === 'get' ? property(receiver, expr.target.key) : await evaluate(expr.target);
                if (typeof fn !== 'function') throw Error('SDK target is not a function');
                const args = await decodeList(expr.args);
                await assertDocument();
                const result = await fn.apply(receiver, args);
                await assertDocument();
                return result;
            })();
            cache.set(expr.id, promise); return promise;
        }
        throw Error('Invalid SDK expression');
    }
    if (packet.action === 'release') {
        for (const id of packet.ids) state.objects.delete(id);
        return null;
    }
    if (packet.action === 'eval') {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const inputs = await decode(packet.inputs);
        await assertDocument();
        const result = await new AsyncFunction('eda', 'inputs', packet.code)(eda, inputs);
        await assertDocument(); return await encode(result);
    }
    const results = [];
    for (const expression of packet.expressions) {
        try {
            await assertDocument();
            const value = await evaluate(expression);
            await assertDocument();
            results.push({ ok: true, value: await encode(value) });
        } catch (error: any) {
            let message = 'Native call failed with an unprintable error';
            try { message = String(error?.message ?? error); } catch { /* Preserve the successful prefix. */ }
            results.push({ ok: false, error: { message } });
            break; // Preserve the successful prefix; never silently continue after a failed edit.
        }
    }
    return results;
}

"""Local EasyEDA SDK. Uses the bundled client-only Node worker; no pip dependencies."""
from __future__ import annotations

import asyncio
import base64
import datetime
import json
import math
import os
from pathlib import Path
import shutil
import uuid
from dataclasses import dataclass

__all__ = ['connect', 'list_instances', 'Session', 'SdkError', 'Blob', 'File', 'ArrayBuffer', 'TypedArray', 'UNDEFINED']


class SdkError(RuntimeError):
    def __init__(self, message, checkpoint=None, outcome_unknown=False, failed_index=None):
        super().__init__(message)
        self.checkpoint = checkpoint
        self.outcome_unknown = outcome_unknown
        self.failed_index = failed_index


class _Undefined:
    def __repr__(self):
        return 'UNDEFINED'


UNDEFINED = _Undefined()


@dataclass
class Blob:
    data: bytes
    type: str = ''

    @property
    def size(self):
        return len(self.data)

    async def arrayBuffer(self):
        return ArrayBuffer(self.data)

    async def text(self):
        return self.data.decode('utf-8', errors='replace')


@dataclass
class File(Blob):
    name: str = ''
    lastModified: int = 0


class ArrayBuffer(bytes):
    pass


@dataclass
class TypedArray:
    data: bytes
    type: str = 'Uint8Array'


def _encode(value, session, seen=None):
    seen = set() if seen is None else seen
    if isinstance(value, _Remote):
        if value._session is not session:
            raise SdkError('Cannot pass an object from another SDK session')
        return {'t': 'expr', 'value': value._expr}
    if value is UNDEFINED:
        return {'t': 'undefined'}
    if isinstance(value, int) and not isinstance(value, bool) and abs(value) > 2**53 - 1:
        return {'t': 'bigint', 'value': str(value)}
    if isinstance(value, float) and not math.isfinite(value):
        return {'t': 'number', 'value': 'NaN' if math.isnan(value) else 'Infinity' if value > 0 else '-Infinity'}
    if value is None or isinstance(value, (str, int, float, bool)):
        return {'t': 'value', 'value': value}
    if isinstance(value, (Blob, ArrayBuffer, TypedArray, bytes, bytearray, memoryview)):
        data = value.data if isinstance(value, (Blob, TypedArray)) else bytes(value)
        kind = 'File' if isinstance(value, File) else 'Blob' if isinstance(value, Blob) else 'ArrayBuffer' if isinstance(value, ArrayBuffer) else value.type if isinstance(value, TypedArray) else 'Uint8Array'
        result = {'t': 'binary', 'type': kind, 'data': base64.b64encode(data).decode('ascii')}
        if isinstance(value, Blob):
            result['mime'] = value.type
        if isinstance(value, File):
            result.update(name=value.name, lastModified=value.lastModified)
        return result
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            raise SdkError('Date arguments must have a timezone')
        return {'t': 'date', 'value': value.isoformat()}
    if id(value) in seen:
        raise SdkError('Cyclic local arguments are unsupported')
    seen = seen | {id(value)}
    if isinstance(value, (list, tuple)):
        return {'t': 'array', 'value': [_encode(v, session, seen) for v in value]}
    if isinstance(value, dict) and all(isinstance(k, str) for k in value):
        return {'t': 'object', 'value': [[k, _encode(v, session, seen)] for k, v in value.items()]}
    raise SdkError('Pass plain data, binary data or a remote object; callbacks require JavaScript')


def _decode(value, session):
    kind = value['t']
    if kind == 'value': return value['value']
    if kind == 'undefined': return UNDEFINED
    if kind == 'bigint': return int(value['value'])
    if kind == 'number': return float(value['value'])
    if kind == 'date': return datetime.datetime.fromisoformat(value['value'].replace('Z', '+00:00'))
    if kind == 'array': return [_decode(v, session) for v in value['value']]
    if kind == 'object': return {k: _decode(v, session) for k, v in value['value']}
    if kind == 'ref':
        if value['sessionId'] != session.id: raise SdkError('Invalid SDK session reference')
        return _Remote(session, {'k': 'ref', 'id': value['id'], 'sessionId': session.id})
    if kind == 'binary':
        data = base64.b64decode(value['data'])
        if value['type'] == 'Blob': return Blob(data, value.get('mime', ''))
        if value['type'] == 'File': return File(data, value.get('mime', ''), value['name'], value['lastModified'])
        if value['type'] == 'ArrayBuffer': return ArrayBuffer(data)
        return TypedArray(data, value['type'])
    raise SdkError('Invalid SDK response')


class _Remote:
    def __init__(self, session, expression):
        self._session = session
        self._expr = expression
        self._future = None

    def __getattr__(self, name):
        if name.startswith('__'): raise AttributeError(name)
        return self[name]

    def __setattr__(self, name, value):
        if not name.startswith('_'):
            raise SdkError('Use native API setters/modify(); assigning to a proxy is unsupported')
        object.__setattr__(self, name, value)

    def __getitem__(self, key):
        if not isinstance(key, (str, int)): raise TypeError('SDK key must be a string or integer')
        return _Remote(self._session, {'k': 'get', 'target': self._expr, 'key': key})

    def __call__(self, *args):
        return _Remote(self._session, {'k': 'call', 'id': str(uuid.uuid4()), 'target': self._expr,
                                      'args': [_encode(a, self._session) for a in args]})

    def __await__(self):
        if self._expr['k'] in ('root', 'ref'):
            async def identity(): return self
            return identity().__await__()
        if self._future is None:
            self._future = self._session._enqueue(self._expr)
        return asyncio.shield(self._future).__await__()

    def __bool__(self):
        raise TypeError('Await the remote value before using it locally')

    def __repr__(self):
        return '<EasyEDA remote expression>'


class Session:
    def __init__(self, process):
        self._process = process
        self._lock = asyncio.Lock()
        self._pending = []
        self._flush_task = None
        self._closed = False
        self.last_checkpoint = None
        self.id = None
        self.instance_id = None
        self.document_uuid = None
        self.eda = _Remote(self, {'k': 'root'})

    async def _rpc(self, method, params=None):
        if self._closed: raise SdkError('SDK session is closed')
        async with self._lock:
            if self._closed: raise SdkError('SDK session is closed')
            rid = str(uuid.uuid4())
            try:
                self._process.stdin.write((json.dumps({'id': rid, 'method': method, 'params': params or {}}, allow_nan=False) + '\n').encode())
                await self._process.stdin.drain()
                # Cancellation must not leave an unread reply to be mistaken for the next request.
                raw = await self._process.stdout.readline()
                if not raw: raise EOFError('SDK worker exited')
                reply = json.loads(raw)
                if reply.get('id') != rid: raise RuntimeError('SDK reply mismatch')
            except BaseException as error:
                self._closed = True
                self._process.stdin.close()
                if isinstance(error, asyncio.CancelledError): raise
                raise SdkError(f'{error}. Execution may still be running; do not retry automatically.', outcome_unknown=True) from error
            if 'error' in reply:
                e = reply['error']
                raise SdkError(e['message'], e.get('checkpoint'), e.get('outcomeUnknown', False), e.get('failedIndex'))
            self.last_checkpoint = reply.get('checkpoint')
            return reply.get('result')

    def _enqueue(self, expression):
        future = asyncio.get_running_loop().create_future()
        self._pending.append((expression, future))
        if self._flush_task is None:
            self._flush_task = asyncio.create_task(self._flush())
        return future

    async def _flush(self):
        await asyncio.sleep(0)  # Coalesce asyncio.gather() calls, matching Promise.all() in Node.
        jobs, self._pending = self._pending, []
        self._flush_task = None
        try:
            results = await self._rpc('packet', {'action': 'calls', 'expressions': [j[0] for j in jobs]})
            for i, (_, future) in enumerate(jobs):
                item = results[i] if i < len(results) else {}
                if item.get('ok'): future.set_result(_decode(item['value'], self))
                else: future.set_exception(SdkError(item.get('error', {}).get('message', 'Not executed because an earlier call failed'), self.last_checkpoint, failed_index=i))
        except Exception as error:
            for _, future in jobs:
                if not future.done(): future.set_exception(error)

    async def eval(self, code, inputs=None):
        return _decode(await self._rpc('packet', {'action': 'eval', 'code': code, 'inputs': _encode(inputs if inputs is not None else {}, self)}), self)

    async def execute_js(self, *, code=None, file_path=None, inputs=None, input_files=None):
        options = {k: v for k, v in {'code': code, 'file_path': str(file_path) if file_path is not None else None,
                   'inputs': inputs, 'input_files': input_files}.items() if v is not None}
        return _decode(await self._rpc('executeJs', options), self)

    async def release(self, *objects):
        ids = []
        for obj in objects:
            if not isinstance(obj, _Remote) or obj._session is not self or obj._expr['k'] != 'ref':
                raise SdkError('Expected an object from this session')
            ids.append(obj._expr['id'])
        await self._rpc('packet', {'action': 'release', 'ids': ids})

    async def close(self):
        if self._flush_task is not None: await self._flush_task
        try:
            if not self._closed: await self._rpc('close')
        finally:
            self._closed = True
            self._process.stdin.close()
            await self._process.wait()

    async def __aenter__(self): return self
    async def __aexit__(self, *args): await self.close()


async def _worker(node=None):
    executable = node or os.environ.get('EASYEDA_COPILOT_NODE') or shutil.which('node')
    if not executable: raise SdkError('Node.js is required; set EASYEDA_COPILOT_NODE to its executable')
    worker = Path(__file__).resolve().parents[2] / 'node' / 'worker.mjs'
    kwargs = {'creationflags': 0x08000000} if os.name == 'nt' else {}
    process = await asyncio.create_subprocess_exec(str(executable), str(worker), stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE, limit=512 * 1024 * 1024, **kwargs)
    return Session(process)


async def connect(*, instance_id=None, document_uuid=UNDEFINED, url=None, timeout_ms=None, node=None):
    session = await _worker(node)
    options = {k: v for k, v in {'instanceId': instance_id, 'url': url, 'timeoutMs': timeout_ms}.items() if v is not None}
    if document_uuid is not UNDEFINED: options['documentUuid'] = document_uuid
    try:
        info = await session._rpc('connect', options)
        session.id, session.instance_id, session.document_uuid = info['sessionId'], info['instanceId'], info['documentUuid']
        return session
    except BaseException:
        await session.close()
        raise


async def list_instances(*, url=None, node=None):
    session = await _worker(node)
    try: return await session._rpc('list', {'url': url} if url else {})
    finally: await session.close()

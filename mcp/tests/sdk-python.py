import asyncio
import sys
import math
from easyeda_copilot import connect, list_instances, Blob, File, TypedArray, ArrayBuffer, UNDEFINED, SdkError
from easyeda_copilot.constants import EPCB_LayerId


async def main():
    url = sys.argv[1]
    assert EPCB_LayerId.TOP == 1
    assert len(await list_instances(url=url)) == 1
    async with await connect(url=url) as s:
        components = await s.eda.pcb_PrimitiveComponent.getAll()
        assert not UNDEFINED
        assert bool(components[0])
        lazy = s.eda.pcb_PrimitiveComponent.getAll()
        try:
            iter(lazy)
            assert False, 'unawaited proxies must not start an unbounded sequence iterator'
        except TypeError:
            pass
        try:
            bool(lazy)
            assert False, 'unawaited expressions must not be used as boolean results'
        except TypeError:
            pass
        assert await asyncio.gather(*(c.getState_Designator() for c in components)) == ['C2', 'R1']
        data = {'blob': Blob(bytes(range(256)) * 8192, 'image/png'), 'file': File(b'hello', 'text/plain', 'test.txt', 123),
                'typed': TypedArray(b'\x01\x00\xfe\xff', 'Int16Array'), 'buffer': ArrayBuffer(b'buffer'), 'missing': UNDEFINED,
                'huge': 12345678901234567890, 'text': '` ${} " \\ \n Unicode', 'values': list(range(20000))}
        assert await s.eda.test.echo(data) == data
        assert math.copysign(1, await s.eda.test.echo(-0.0)) == -1
        assert (await s.eda.test.echo(b'hello')).data == b'hello'
        assert await (await s.eda.test.echo(components[0])).getState_Designator() == 'C2'
        assert await (await s.eval('return inputs.c', {'c': components[0]})).getState_Designator() == 'C2'
        call = s.eda.pcb_PrimitiveComponent.create()
        first = await call
        assert await call.getState_Designator() == await first.getState_Designator() == 'NEW'
        assert await s.execute_js(code='return inputs.x', inputs={'x': 'old script'}) == 'old script'
        image = await s.execute_js(code='return new Blob(["abc"], {type:"image/png"})')
        assert isinstance(image, Blob) and image.data == b'abc'
        results = await asyncio.gather(s.eda.test.scalar(), s.eda.test.fail(), s.eda.test.scalar(), return_exceptions=True)
        assert results[0] == 42 and isinstance(results[1], SdkError) and results[1].checkpoint
        assert isinstance(results[2], SdkError) and 'Not executed' in str(results[2])
        await s.release(components[0])
        try:
            await components[0].getState_Designator()
            assert False, 'released reference unexpectedly worked'
        except SdkError:
            pass
        # Cancelling one waiter must not cancel a shared expression or desynchronize replies.
        call = s.eda.test.slow(80, 'shared')
        first = asyncio.ensure_future(call)
        second = asyncio.ensure_future(call)
        await asyncio.sleep(0.02)
        first.cancel()
        assert isinstance((await asyncio.gather(first, return_exceptions=True))[0], asyncio.CancelledError)
        assert await second == 'shared'
        assert await s.eda.test.scalar() == 42
        async with s.checkpoint_scope('Python scope') as scope:
            cp=scope.checkpoint_id
            assert await scope.eda.test.scalar()==42 and s.last_checkpoint==cp
            assert await s.eval('return 7')==7 and s.last_checkpoint==cp
            assert await s.execute_js(code='return 8')==8 and s.last_checkpoint==cp
            try:
                async with s.checkpoint_scope('nested'): pass
                assert False
            except SdkError: pass
        assert await s.eda.test.scalar()==42 and s.last_checkpoint!=cp
        try:
            async with s.checkpoint_scope('Python failure') as scope:
                cp=scope.checkpoint_id
                await scope.eda.test.fail()
        except SdkError as error:
            assert error.checkpoint==cp
        await asyncio.gather(scope.close(),scope.close())
        entered=asyncio.Event()
        async def interrupted_scope():
            async with s.checkpoint_scope('cancel local calculation') as scope:
                await scope.eda.test.scalar()
                entered.set()
                await asyncio.sleep(30)
        task=asyncio.create_task(interrupted_scope())
        await entered.wait();task.cancel()
        assert isinstance((await asyncio.gather(task,return_exceptions=True))[0],asyncio.CancelledError)
        assert s._scope is None
        assert await s.eda.test.scalar()==42
        # Invalid local inputs must not break a healthy session.
        try:
            await s.execute_js(code='return inputs.x', inputs={'x': object()})
            assert False
        except SdkError as error:
            assert not error.outcome_unknown
        assert await s.eda.test.scalar() == 42
    closing = await connect(url=url)
    await asyncio.gather(closing.close(), closing.close(), closing.close())
    assert closing._process.returncode == 0
    # Cancel a whole RPC whose eventual reply would exceed an OS pipe buffer.
    cancelled = await connect(url=url)
    task = asyncio.create_task(cancelled.eval('await eda.test.slow(150, null); return new Blob([new Uint8Array(1024*1024)]);'))
    await asyncio.sleep(0.03)
    task.cancel()
    assert isinstance((await asyncio.gather(task, return_exceptions=True))[0], asyncio.CancelledError)
    await asyncio.wait_for(cancelled.close(), timeout=3)
    assert cancelled._process.returncode is not None
    print('Python proxy, binary and lifecycle checks passed.')


asyncio.run(main())

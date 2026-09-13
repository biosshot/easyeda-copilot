import asyncio
import sys
from easyeda_copilot import connect, list_instances, Blob, File, TypedArray, ArrayBuffer, UNDEFINED, SdkError
from easyeda_copilot.constants import EPCB_LayerId


async def main():
    url = sys.argv[1]
    assert EPCB_LayerId.TOP == 1
    assert len(await list_instances(url=url)) == 1
    async with await connect(url=url) as s:
        components = await s.eda.pcb_PrimitiveComponent.getAll()
        assert await asyncio.gather(*(c.getState_Designator() for c in components)) == ['C2', 'R1']
        data = {'blob': Blob(bytes(range(256)) * 8192, 'image/png'), 'file': File(b'hello', 'text/plain', 'test.txt', 123),
                'typed': TypedArray(b'\x01\x00\xfe\xff', 'Int16Array'), 'buffer': ArrayBuffer(b'buffer'), 'missing': UNDEFINED,
                'huge': 12345678901234567890, 'text': '` ${} " \\ \n Unicode', 'values': list(range(20000))}
        assert await s.eda.test.echo(data) == data
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
    print('Python proxy, binary and lifecycle checks passed.')


asyncio.run(main())

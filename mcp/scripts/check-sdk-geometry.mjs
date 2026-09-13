import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { milToMm,mmToMil,convertLength,assertUnitScale } from '../dist/lib/node/index.mjs';
assert.equal(milToMm(100),2.54);assert.equal(mmToMil(2.54),100);
assert.equal(convertLength(10,.254),2.54);assertUnitScale(10,2.54,.254,.001);
assert.throws(()=>assertUnitScale(10,2.54,.0254,.001),/mismatch/);
for(const args of [[true,1],[NaN,1],[1,0],[1,-1],[1,1,0]])assert.throws(()=>convertLength(...args));
const root=fileURLToPath(new URL('../',import.meta.url));
const python=process.env.EASYEDA_COPILOT_PYTHON || (process.platform==='win32'?'python':'python3');
const probe=spawnSync(python,['-c','import shapely'],{windowsHide:true,encoding:'utf8'});
if(probe.status!==0 && process.env.SDK_SHAPELY_REQUIRED!=='1') {
    console.log('PASS Node units; SKIP optional Shapely examples (install Shapely 2.x, set SDK_SHAPELY_REQUIRED=1 to require)');
} else {
    const result=spawnSync(python,[resolve(root,'tests/sdk-geometry.py')],{windowsHide:true,stdio:'inherit',env:{...process.env,PYTHONPATH:resolve(root,'dist/lib/python')}});
    assert.equal(result.status,0,'Python geometry tests failed');
    console.log('PASS Node units and Python/Shapely geometry examples');
}

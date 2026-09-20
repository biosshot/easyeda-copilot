import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointScopes } from '../src/eda/checkpoint-scopes';

function fixture() {
    let time=1, count=0, doc='pcb', writes=0;
    const pins=new Map<string,number>();
    const api={dmt_SelectControl:{getCurrentDocumentInfo:async()=>({uuid:doc})},write:()=>++writes};
    const scopes=new CheckpointScopes({save:async()=>`cp-${++count}`,pin:(id,t)=>{pins.set(id,t)},unpin:id=>{pins.delete(id)}},()=>time,()=>`token-${count}`,100);
    const run=(checkpointScope?:unknown,epoch=1)=>scopes.execute({code:'return eda.write()',checkpointScope},api,epoch);
    return {run,pins,get count(){return count},get writes(){return writes},set time(t:number){time=t},set doc(d:string){doc=d}};
}
test('ordinary execution saves each time; control messages do not execute supplied JS',async()=>{
    const f=fixture();await f.run();await f.run();assert.equal(f.count,2);assert.equal(f.writes,2);
    const begin=await f.run({action:'begin',sessionId:'a',name:'Edit',documentUuid:'pcb'});
    const token=begin.checkpointScope!.token;
    assert.equal(f.writes,2);assert.equal(f.count,3);
    for(let i=0;i<5;i++) assert.equal((await f.run({action:'use',sessionId:'a',token})).checkpoint,begin.checkpoint);
    assert.equal(f.count,3);assert.equal(f.writes,7);
    await f.run({action:'end',sessionId:'a',token});assert.equal(f.pins.size,0);assert.equal(f.writes,7);
    assert.ok((await f.run({action:'use',sessionId:'a',token})).error);assert.equal(f.writes,7);
});
test('begin without a document UUID binds the active document',async()=>{
    const f=fixture();
    const begin=await f.run({action:'begin',sessionId:'a',name:'Automatic Node SDK scope'});
    assert.equal(begin.checkpointScope?.documentUuid,'pcb');
    assert.equal(f.count,1);assert.equal(f.writes,0);
});
test('wrong session, wrong document, expired and reconnect tokens cannot execute',async()=>{
    for(const mode of ['owner','document','expiry','epoch']) {
        const f=fixture();const b=await f.run({action:'begin',sessionId:'a',name:'Edit',documentUuid:'pcb'});
        if(mode==='document')f.doc='schematic';if(mode==='expiry')f.time=102;
        const r=await f.run({action:'use',sessionId:mode==='owner'?'b':'a',token:b.checkpointScope!.token},mode==='epoch'?2:1);
        assert.ok(r.error,mode);assert.equal(f.writes,0);assert.equal(f.count,1);
    }
});
test('invalid and nested scopes fail before a baseline or body is created',async()=>{
    const f=fixture();
    for(const raw of [null,[],{}, {action:'begin',sessionId:'a',name:'',documentUuid:'pcb'}, {action:'begin',sessionId:'a',name:'x',documentUuid:'other'}]) assert.ok((await f.run(raw)).error);
    assert.equal(f.count,0);assert.equal(f.writes,0);
    await f.run({action:'begin',sessionId:'a',name:'x',documentUuid:'pcb'});
    assert.ok((await f.run({action:'begin',sessionId:'a',name:'x',documentUuid:'pcb'})).error);
    assert.equal(f.count,1);
});

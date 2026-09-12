# SYS\_Tool class

System / tool class

## Signature

```typescript
class SYS_Tool
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[netlistComparison(netlist1, netlist2)](./SYS_Tool.md)||**_(BETA)_** Netlist comparison|

---

## 方法详情

### netlistcomparison

# SYS\_Tool.netlistComparison() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Netlist comparison

## Signature

```typescript
function netlistComparison(
	netlist1: string | { projectUuid: string; documentUuid: string } | File,
	netlist2: string | { projectUuid: string; documentUuid: string } | File,
): Promise<
	Array<{
		type: 'Net' | 'Component';
		object: string;
		netlist1Name: Array<string>;
		netlist2Name: Array<string>;
	}>
>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netlist1|string \| { projectUuid: string; documentUuid: string } \| File|Netlist 1, which can be: 1. The UUID of a schematic or PCB in the current project; 2. The project UUID and schematic/PCB UUID of another project; 3. Schematic or PCB file data|
|netlist2|string \| { projectUuid: string; documentUuid: string } \| File|Netlist 2, which can be: 1. The UUID of a schematic or PCB in the current project; 2. The project UUID and schematic/PCB UUID of another project; 3. Schematic or PCB file data|

## Returns

Promise&lt;Array&lt;{ type: 'Net' \| 'Component'; object: string; netlist1Name: Array&lt;string&gt;; netlist2Name: Array&lt;string&gt; }&gt;&gt;

Netlist comparison result

## Example

```javascript
// 1. 取工程内前两张 PCB 作为两份网表的来源
const pcbs = await eda.dmt_Pcb.getAllPcbsInfo();
const docA = pcbs[0];
const docB = pcbs[1];

// 2. 同一文档与自身对比：网表完全一致，返回空数组（无差异）
const selfDiff = await eda.sys_Tool.netlistComparison(docA.uuid, docA.uuid);
console.log('自身对比差异条数：', selfDiff.length);

// 3. 两张不同 PCB 对比：返回差异清单
const diff = await eda.sys_Tool.netlistComparison(docA.uuid, docB.uuid);
console.log('两文档对比差异条数：', diff.length);

// 4. 展示差异结构：type 为差异类型，object 为差异对象，
// net1 / net2 分别是该对象在两份网表中的名称列表（运行时字段名）
for (const item of diff.slice(0, 5)) {
	console.log('差异：', item.type, item.object, '网表 1：', item.net1.join('、') || '（无）', '网表 2：', item.net2.join('、') || '（无）');
}
```

# SYS\_ShortcutKey class

System / shortcut key class

## Signature

```typescript
class SYS_ShortcutKey
```

## Remarks

Register and manage system shortcut keys

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[getShortcutKeys(includeSystem)](./SYS_ShortcutKey.md)||**_(BETA)_** Query shortcut key list|
|[registerShortcutKey(shortcutKey, title, callbackFn, documentType, scene)](./SYS_ShortcutKey.md)||**_(BETA)_** Register shortcut key|
|[unregisterShortcutKey(shortcutKey)](./SYS_ShortcutKey.md)||**_(BETA)_** Unregister a shortcut key|

---

## 方法详情

### getshortcutkeys

# SYS\_ShortcutKey.getShortcutKeys() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Query shortcut key list

## Signature

```typescript
function getShortcutKeys(
	includeSystem?: boolean,
): Promise<
	Array<{
		shortcutKey: TSYS_ShortcutKeys;
		title: string;
		documentType: Array<ESYS_ShortcutKeyEffectiveEditorDocumentType>;
		scene: Array<ESYS_ShortcutKeyEffectiveEditorScene>;
	}>
>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|includeSystem|boolean|_(Optional)_ Whether Contain system shortcut key|

## Returns

Promise&lt;Array&lt;{ shortcutKey: [TSYS\_ShortcutKeys](../types/TSYS_ShortcutKeys.md)<!-- -->; title: string; documentType: Array&lt;[ESYS\_ShortcutKeyEffectiveEditorDocumentType](../enums/ESYS_ShortcutKeyEffectiveEditorDocumentType.md)<!-- -->&gt;; scene: Array&lt;[ESYS\_ShortcutKeyEffectiveEditorScene](../enums/ESYS_ShortcutKeyEffectiveEditorScene.md)<!-- -->&gt; }&gt;&gt;

Shortcut key list

## Example

```javascript
// 1. 只查非系统快捷键（扩展注册的），列表精简便于观察
const custom = await eda.sys_ShortcutKey.getShortcutKeys();
console.log('非系统快捷键数量：', custom.length);

// 2. 连同系统快捷键一起查（用于完整键位冲突检测）
const all = await eda.sys_ShortcutKey.getShortcutKeys(true);
console.log('含系统快捷键总数：', all.length);

// 3. 观察单条数据结构：shortcutKey 是键位数组，title 是名称，
// documentType 是生效页面，scene 是生效场景
const sample = all[0];
console.log('首条快捷键：', JSON.stringify(sample));
```


### registershortcutkey

# SYS\_ShortcutKey.registerShortcutKey() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Register shortcut key

## Signature

```typescript
function registerShortcutKey(
	shortcutKey: TSYS_ShortcutKeys,
	title: string,
	callbackFn: (shortcutKey: TSYS_ShortcutKeys) => void | Promise<void>,
	documentType?: Array<ESYS_ShortcutKeyEffectiveEditorDocumentType>,
	scene?: Array<ESYS_ShortcutKeyEffectiveEditorScene>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|shortcutKey|[TSYS\_ShortcutKeys](../types/TSYS_ShortcutKeys.md)|Shortcut key. If the array contains multiple elements, it is parsed as a combined shortcut key and sorted by rules before being stored in the cache|
|title|string|Shortcut key title, the friendly name of the shortcut key|
|callbackFn|(shortcutKey: [TSYS\_ShortcutKeys](../types/TSYS_ShortcutKeys.md)<!-- -->) =&gt; void \| Promise&lt;void&gt;|Callback function|
|documentType|Array&lt;[ESYS\_ShortcutKeyEffectiveEditorDocumentType](../enums/ESYS_ShortcutKeyEffectiveEditorDocumentType.md)<!-- -->&gt;|_(Optional)_|
|scene|Array&lt;[ESYS\_ShortcutKeyEffectiveEditorScene](../enums/ESYS_ShortcutKeyEffectiveEditorScene.md)<!-- -->&gt;|_(Optional)_|

## Returns

Promise&lt;boolean&gt;

Register whether the operation is successful

## Example

```javascript
// 1. 注册冷门组合键 Ctrl+Alt+Shift+F9，避免占用常用键位
// documentType 传 2（原理图图页）与 4（PCB）；scene 传 4（画布绘制）
const ok = await eda.sys_ShortcutKey.registerShortcutKey(
	['CONTROL', 'ALT', 'SHIFT', 'F9'],
	'嘉立创示例_演示快捷键',
	(shortcutKey) => {
		// 用户实际按键时才触发，自动化测试不按键，此处仅演示回调写法
		console.log('快捷键被按下：', JSON.stringify(shortcutKey));
	},
	[2, 4],
	[4]
);
console.log('注册快捷键返回：', ok);

// 2. 查询验证：新注册的快捷键出现在非系统快捷键列表中
const list = await eda.sys_ShortcutKey.getShortcutKeys();
const found = list.some(item => item.title === '嘉立创示例_演示快捷键');
console.log('已注册到快捷键列表：', found);

// 3. 反注册还原键位，保证案例可重复运行且不残留全局快捷键
const removed = await eda.sys_ShortcutKey.unregisterShortcutKey(['CONTROL', 'ALT', 'SHIFT', 'F9']);
console.log('反注册还原返回：', removed);
```


### unregistershortcutkey

# SYS\_ShortcutKey.unregisterShortcutKey() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Unregister a shortcut key

## Signature

```typescript
function unregisterShortcutKey(shortcutKey: TSYS_ShortcutKeys): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|shortcutKey|[TSYS\_ShortcutKeys](../types/TSYS_ShortcutKeys.md)|Shortcut key. The order of the passed-in elements is not distinguished; it will be sorted automatically and the matching shortcut key will be queried|

## Returns

Promise&lt;boolean&gt;

Whether the unregistration operation was successful

## Example

```javascript
// 1. 先注册一个演示快捷键作为操作对象
await eda.sys_ShortcutKey.registerShortcutKey(
	['CONTROL', 'ALT', 'F9'],
	'嘉立创示例_待移除快捷键',
	() => {}
);

// 2. 反注册：故意打乱键序传入，验证不区分排列顺序的匹配规则
const ok = await eda.sys_ShortcutKey.unregisterShortcutKey(['F9', 'ALT', 'CONTROL']);
console.log('反注册返回：', ok);

// 3. 复查快捷键列表，确认演示键位已被移除
const list = await eda.sys_ShortcutKey.getShortcutKeys();
const still = list.some(item => item.title === '嘉立创示例_待移除快捷键');
console.log('反注册后仍在列表中：', still);
```

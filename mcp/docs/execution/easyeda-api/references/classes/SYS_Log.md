# SYS\_Log class

System / log class

## Signature

```typescript
class SYS_Log
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[add(message, type)](./SYS_Log.md)||Add a log entry|
|[clear()](./SYS_Log.md)||Clear the log|
|[export(types)](./SYS_Log.md)||Export the log|
|[find(message, types)](./SYS_Log.md)||Find entries|
|[sort(types)](./SYS_Log.md)||Filter and get log entries|

---

## 方法详情

### add

# SYS\_Log.add() method

Add a log entry

## Signature

```typescript
function add(message: string, type?: ESYS_LogType): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|message|string|Log content|
|type|[ESYS\_LogType](../enums/ESYS_LogType.md)|_(Optional)_ Log type|

## Returns

void

## Example

```javascript
// 1. 写入三条不同类型的日志（同步调用，立即生效）
eda.sys_Log.add('嘉立创示例_插件启动，开始处理任务');
eda.sys_Log.add('嘉立创示例_检测到网络波动，将自动重试', 'warn');
eda.sys_Log.add('嘉立创示例_文件解析失败', 'error');

// 2. 查询日志面板，确认条目已写入（find 返回 Promise，需要 await）
const found = await eda.sys_Log.find('嘉立创示例_');
console.log('写入的日志条目数：', found.length);
console.log('其中一条：', found[0].message, '（类型：', `${found[0].type}）`);
```


### clear

# SYS\_Log.clear() method

Clear the log

## Signature

```typescript
function clear(): void;
```

## Returns

void

## Example

```javascript
// 1. 先写入几条示例日志，让清空效果可见
eda.sys_Log.add('嘉立创示例_清空前日志 1');
eda.sys_Log.add('嘉立创示例_清空前日志 2', 'warn');
const before = await eda.sys_Log.sort();
console.log('清空前的日志条目数：', before.length);

// 2. 清空日志面板（同步调用，立即生效）
eda.sys_Log.clear();

// 3. 再次查询，确认面板已清空
const after = await eda.sys_Log.sort();
console.log('清空后的日志条目数：', after.length);
```


### export

# SYS\_Log.export() method

Export the log

## Signature

```typescript
function export(types?: ESYS_LogType | Array<ESYS_LogType>): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|types|[ESYS\_LogType](../enums/ESYS_LogType.md) \| Array&lt;[ESYS\_LogType](../enums/ESYS_LogType.md)<!-- -->&gt;|_(Optional)_ Log type|

## Returns

void

## Example

```javascript
// 1. 先写入几条不同类型的日志，保证导出内容可辨识
eda.sys_Log.add('嘉立创示例_导出演示：信息条目');
eda.sys_Log.add('嘉立创示例_导出演示：警告条目', 'warn');

// 2. 导出全部日志（同步调用，触发一次文件保存）
eda.sys_Log.export();
console.log('已导出全部日志');

// 3. 按类型筛选导出，只导出警告和错误级别（数组可同时指定多种类型）
eda.sys_Log.export(['warn', 'error']);
console.log('已导出 warn 和 error 类型的日志');
```


### find

# SYS\_Log.find() method

Find entries

## Signature

```typescript
function find(
	message:
		| string
		| Array<
			| string
			| {
				text: string;
				attr?: {
					id?: string;
					path?: string;
					sheet?: string;
					pcbid?: string;
					type?: string;
				};
			}
		>,
	types?: ESYS_LogType | Array<ESYS_LogType>,
): Promise<Array<ISYS_LogLine>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|message|string \| Array&lt;string \| { text: string; attr?: { id?: string; path?: string; sheet?: string; pcbid?: string; type?: string } }&gt;|Find content|
|types|[ESYS\_LogType](../enums/ESYS_LogType.md) \| Array&lt;[ESYS\_LogType](../enums/ESYS_LogType.md)<!-- -->&gt;|_(Optional)_ Array of log types. The search can be performed within the specified log types|

## Returns

Promise&lt;Array&lt;[ISYS\_LogLine](../interfaces/ISYS_LogLine.md)<!-- -->&gt;&gt;

Array of log entries matching the find criteria

## Remarks

If the log panel is open, the find operation will also be displayed on the front end

## Example

```javascript
// 1. 写入待查找的示例日志（一条 info、一条 error）
eda.sys_Log.add('嘉立创示例_查找演示：任务开始');
eda.sys_Log.add('嘉立创示例_查找演示：网络请求失败', 'error');

// 2. 按关键字查找全部匹配条目（返回 Promise，需要 await）
const all = await eda.sys_Log.find('嘉立创示例_查找演示');
console.log('关键字匹配条目数：', all.length);

// 3. 限定只在 error 类型中查找，缩小搜索范围
const errors = await eda.sys_Log.find('嘉立创示例_查找演示', 'error');
console.log('error 类型匹配条目数：', errors.length);
console.log('匹配内容：', errors.map(line => line.message).join('；'));
```


### sort

# SYS\_Log.sort() method

Filter and get log entries

## Signature

```typescript
function sort(types?: ESYS_LogType | Array<ESYS_LogType>): Promise<Array<ISYS_LogLine>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|types|[ESYS\_LogType](../enums/ESYS_LogType.md) \| Array&lt;[ESYS\_LogType](../enums/ESYS_LogType.md)<!-- -->&gt;|_(Optional)_ Array of log types. Multiple log types can be specified at the same time. If not specified, all types are used|

## Returns

Promise&lt;Array&lt;[ISYS\_LogLine](../interfaces/ISYS_LogLine.md)<!-- -->&gt;&gt;

Array of log entries matching the filter criteria

## Remarks

If the log panel is open, the filter operation will also be displayed on the front end

## Example

```javascript
// 1. 写入三种不同类型的示例日志，便于观察筛选效果
eda.sys_Log.add('嘉立创示例_筛选演示：常规信息');
eda.sys_Log.add('嘉立创示例_筛选演示：电压偏高', 'warn');
eda.sys_Log.add('嘉立创示例_筛选演示：铺铜失败', 'error');

// 2. 不传参数，获取全部类型的日志（返回 Promise，需要 await）
const all = await eda.sys_Log.sort();
console.log('全部日志条目数：', all.length);

// 3. 传入类型数组，只筛选警告和错误两类
const problems = await eda.sys_Log.sort(['warn', 'error']);
console.log('警告和错误条目数：', problems.length);
console.log('问题明细：', problems.map(line => `[${line.type}] ${line.message}`).join('；'));
```

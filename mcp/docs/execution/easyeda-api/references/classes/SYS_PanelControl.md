# SYS\_PanelControl class

System / panel control class

## Signature

```typescript
class SYS_PanelControl
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[closeBottomPanel()](./SYS_PanelControl.md)||Close the bottom panel|
|[closeLeftPanel()](./SYS_PanelControl.md)||Close the left panel|
|[closeRightPanel()](./SYS_PanelControl.md)||Close the right panel|
|[isBottomPanelLocked()](./SYS_PanelControl.md)||Query whether the bottom panel is locked|
|[isLeftPanelLocked()](./SYS_PanelControl.md)||Query whether the left panel is locked|
|[isRightPanelLocked()](./SYS_PanelControl.md)||Query whether the right panel is locked|
|[openBottomPanel(tab)](./SYS_PanelControl.md)||Open the bottom panel|
|[openLeftPanel(tab)](./SYS_PanelControl.md)||Open the left panel|
|[openRightPanel(tab)](./SYS_PanelControl.md)||Open the right panel|
|[toggleBottomPanelLockState(state)](./SYS_PanelControl.md)||Toggle the lock state of the bottom panel|
|[toggleLeftPanelLockState(state)](./SYS_PanelControl.md)||Toggle the lock state of the left panel|
|[toggleRightPanelLockState(state)](./SYS_PanelControl.md)||Toggle the lock state of the right panel|

---

## 方法详情

### closebottompanel

# SYS\_PanelControl.closeBottomPanel() method

Close the bottom panel

## Signature

```typescript
function closeBottomPanel(): void;
```

## Returns

void

## Example

```javascript
// 1. 先展开底部面板制造“已打开”状态，便于观察关闭效果
eda.sys_PanelControl.openBottomPanel('log');
console.log('底部面板已展开');

// 2. 收起底部面板（同步调用，无返回值）
eda.sys_PanelControl.closeBottomPanel();
console.log('底部面板已收起');
```


### closeleftpanel

# SYS\_PanelControl.closeLeftPanel() method

Close the left panel

## Signature

```typescript
function closeLeftPanel(): void;
```

## Returns

void

## Example

```javascript
// 1. 先展开左侧面板制造“已打开”状态（不传 tab 则保持当前标签页）
eda.sys_PanelControl.openLeftPanel();
console.log('左侧面板已展开');

// 2. 收起左侧面板（同步调用，无返回值）
eda.sys_PanelControl.closeLeftPanel();
console.log('左侧面板已收起');
```


### closerightpanel

# SYS\_PanelControl.closeRightPanel() method

Close the right panel

## Signature

```typescript
function closeRightPanel(): void;
```

## Returns

void

## Example

```javascript
// 1. 先展开右侧面板制造“已打开”状态（不传 tab 则保持当前标签页）
eda.sys_PanelControl.openRightPanel();
console.log('右侧面板已展开');

// 2. 收起右侧面板（同步调用，无返回值）
eda.sys_PanelControl.closeRightPanel();
console.log('右侧面板已收起');
```


### isbottompanellocked

# SYS\_PanelControl.isBottomPanelLocked() method

Query whether the bottom panel is locked

## Signature

```typescript
function isBottomPanelLocked(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether Already lock

## Example

```javascript
// 1. 查询底部面板当前锁定状态（异步方法，需要 await）
const locked = await eda.sys_PanelControl.isBottomPanelLocked();

// 2. 输出查询结果（true 表示已锁定，false 表示未锁定）
console.log('底部面板锁定状态：', locked);
```


### isleftpanellocked

# SYS\_PanelControl.isLeftPanelLocked() method

Query whether the left panel is locked

## Signature

```typescript
function isLeftPanelLocked(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether Already lock

## Example

```javascript
// 1. 查询左侧面板当前锁定状态（异步方法，需要 await）
const locked = await eda.sys_PanelControl.isLeftPanelLocked();

// 2. 输出查询结果（true 表示已锁定，false 表示未锁定）
console.log('左侧面板锁定状态：', locked);
```


### isrightpanellocked

# SYS\_PanelControl.isRightPanelLocked() method

Query whether the right panel is locked

## Signature

```typescript
function isRightPanelLocked(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether Already lock

## Example

```javascript
// 1. 查询右侧面板当前锁定状态（异步方法，需要 await）
const locked = await eda.sys_PanelControl.isRightPanelLocked();

// 2. 输出查询结果（true 表示已锁定，false 表示未锁定）
console.log('右侧面板锁定状态：', locked);
```


### openbottompanel

# SYS\_PanelControl.openBottomPanel() method

Open the bottom panel

## Signature

```typescript
function openBottomPanel(tab?: ESYS_BottomPanelTab): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|tab|[ESYS\_BottomPanelTab](../enums/ESYS_BottomPanelTab.md)|_(Optional)_ Tab. If not specified, the tab will not be switched|

## Returns

void

## Example

```javascript
// 1. 打开底部面板并切换到日志标签页（'log' 不依赖文档类型，最通用）
eda.sys_PanelControl.openBottomPanel('log');
console.log('底部面板已展开，并切换到日志标签页');

// 2. 收起面板还原界面（自建自删，保证案例可重复运行）
eda.sys_PanelControl.closeBottomPanel();
console.log('底部面板已收起，界面还原');
```


### openleftpanel

# SYS\_PanelControl.openLeftPanel() method

Open the left panel

## Signature

```typescript
function openLeftPanel(tab?: ESYS_LeftPanelTab): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|tab|[ESYS\_LeftPanelTab](../enums/ESYS_LeftPanelTab.md)|_(Optional)_ Tab. If not specified, the tab will not be switched|

## Returns

void

## Example

```javascript
// 1. 打开左侧面板并切换到工程设计标签页
eda.sys_PanelControl.openLeftPanel('projectDesign');
console.log('左侧面板已展开，并切换到工程设计标签页');

// 2. 收起面板还原界面（自建自删，保证案例可重复运行）
eda.sys_PanelControl.closeLeftPanel();
console.log('左侧面板已收起，界面还原');
```


### openrightpanel

# SYS\_PanelControl.openRightPanel() method

Open the right panel

## Signature

```typescript
function openRightPanel(tab?: ESYS_RightPanelTab): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|tab|[ESYS\_RightPanelTab](../enums/ESYS_RightPanelTab.md)|_(Optional)_ Tab. If not specified, the tab will not be switched|

## Returns

void

## Example

```javascript
// 1. 打开右侧面板并切换到批注标签页（'annotation' 不依赖文档类型）
eda.sys_PanelControl.openRightPanel('annotation');
console.log('右侧面板已展开，并切换到批注标签页');

// 2. 收起面板还原界面（自建自删，保证案例可重复运行）
eda.sys_PanelControl.closeRightPanel();
console.log('右侧面板已收起，界面还原');
```


### togglebottompanellockstate

# SYS\_PanelControl.toggleBottomPanelLockState() method

Toggle the lock state of the bottom panel

## Signature

```typescript
function toggleBottomPanelLockState(state?: boolean): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|state|boolean|_(Optional)_ Whether to lock. If not specified, the current state is inverted|

## Returns

void

## Example

```javascript
// 1. 记录当前锁定状态（异步查询，需要 await）
const before = await eda.sys_PanelControl.isBottomPanelLocked();

// 2. 切换到相反状态（显式传目标值；不传参数则直接反转当前状态）
eda.sys_PanelControl.toggleBottomPanelLockState(!before);

// 3. 验证切换已生效
const after = await eda.sys_PanelControl.isBottomPanelLocked();
console.log('切换前：', before, '切换后：', after);

// 4. 恢复原始锁定状态（不留痕迹，保证案例可重复运行）
eda.sys_PanelControl.toggleBottomPanelLockState(before);
console.log('已恢复原锁定状态：', before);
```


### toggleleftpanellockstate

# SYS\_PanelControl.toggleLeftPanelLockState() method

Toggle the lock state of the left panel

## Signature

```typescript
function toggleLeftPanelLockState(state?: boolean): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|state|boolean|_(Optional)_ Whether to lock. If not specified, the current state is inverted|

## Returns

void

## Example

```javascript
// 1. 记录当前锁定状态（异步查询，需要 await）
const before = await eda.sys_PanelControl.isLeftPanelLocked();

// 2. 切换到相反状态（显式传目标值；不传参数则直接反转当前状态）
eda.sys_PanelControl.toggleLeftPanelLockState(!before);

// 3. 验证切换已生效
const after = await eda.sys_PanelControl.isLeftPanelLocked();
console.log('切换前：', before, '切换后：', after);

// 4. 恢复原始锁定状态（不留痕迹，保证案例可重复运行）
eda.sys_PanelControl.toggleLeftPanelLockState(before);
console.log('已恢复原锁定状态：', before);
```


### togglerightpanellockstate

# SYS\_PanelControl.toggleRightPanelLockState() method

Toggle the lock state of the right panel

## Signature

```typescript
function toggleRightPanelLockState(state?: boolean): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|state|boolean|_(Optional)_ Whether to lock. If not specified, the current state is inverted|

## Returns

void

## Example

```javascript
// 1. 记录当前锁定状态（异步查询，需要 await）
const before = await eda.sys_PanelControl.isRightPanelLocked();

// 2. 切换到相反状态（显式传目标值；不传参数则直接反转当前状态）
eda.sys_PanelControl.toggleRightPanelLockState(!before);

// 3. 验证切换已生效
const after = await eda.sys_PanelControl.isRightPanelLocked();
console.log('切换前：', before, '切换后：', after);

// 4. 恢复原始锁定状态（不留痕迹，保证案例可重复运行）
eda.sys_PanelControl.toggleRightPanelLockState(before);
console.log('已恢复原锁定状态：', before);
```

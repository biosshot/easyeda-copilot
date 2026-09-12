# SYS\_LoadingAndProgressBar class

System / loading and progress bar class

## Signature

```typescript
class SYS_LoadingAndProgressBar
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[destroyLoading()](./SYS_LoadingAndProgressBar.md)||Destroy the no-progress loading overlay|
|[destroyProgressBar()](./SYS_LoadingAndProgressBar.md)||Destroy the progress bar|
|[showLoading()](./SYS_LoadingAndProgressBar.md)||Show the no-progress loading overlay|
|[showProgressBar(progress, title)](./SYS_LoadingAndProgressBar.md)||Show the progress bar or set its progress|

---

## 方法详情

### destroyloading

# SYS\_LoadingAndProgressBar.destroyLoading() method

Destroy the no-progress loading overlay

## Signature

```typescript
function destroyLoading(): void;
```

## Returns

void

## Example

```javascript
// 1. 先显示加载覆盖作为销毁对象（与 showLoading 成对演示）
eda.sys_LoadingAndProgressBar.showLoading();
console.log('加载覆盖已显示');
await new Promise(r => setTimeout(r, 800));

// 2. 销毁覆盖，编辑器恢复可操作（同步调用，无返回值）
eda.sys_LoadingAndProgressBar.destroyLoading();
console.log('加载覆盖已销毁，编辑器恢复可操作');
```


### destroyprogressbar

# SYS\_LoadingAndProgressBar.destroyProgressBar() method

Destroy the progress bar

## Signature

```typescript
function destroyProgressBar(): void;
```

## Returns

void

## Example

```javascript
// 1. 先显示一个进度未满的进度条作为销毁对象
eda.sys_LoadingAndProgressBar.showProgressBar(50, '嘉立创示例 正在处理');
console.log('进度条已显示，当前进度 50%');
await new Promise(r => setTimeout(r, 800));

// 2. 销毁进度条（同步调用，无返回值）
eda.sys_LoadingAndProgressBar.destroyProgressBar();
console.log('进度条已销毁');
```


### showloading

# SYS\_LoadingAndProgressBar.showLoading() method

Show the no-progress loading overlay

## Signature

```typescript
function showLoading(): void;
```

## Returns

void

## Remarks

There is no progress indicator, but a gray overlay consistent with the progress bar will appear to prevent further user operations

## Example

```javascript
// 1. 显示无进度加载覆盖（同步调用，无返回值）
eda.sys_LoadingAndProgressBar.showLoading();
console.log('加载覆盖已显示，编辑器被灰色覆盖锁定');

// 2. 停留片刻便于观察，随后销毁覆盖还原界面（自建自删，保证案例可重复运行）
await new Promise(r => setTimeout(r, 1000));
eda.sys_LoadingAndProgressBar.destroyLoading();
console.log('加载覆盖已销毁，编辑器恢复可操作');
```


### showprogressbar

# SYS\_LoadingAndProgressBar.showProgressBar() method

Show the progress bar or set its progress

## Signature

```typescript
function showProgressBar(progress?: number, title?: string): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|progress|number|_(Optional)_ Progress value, value range `0-100`|
|title|string|_(Optional)_ Progress bar title|

## Returns

void

## Remarks

When the progress reaches `100`<!-- -->, the progress bar will be automatically destroyed

## Example

```javascript
// 1. 显示进度条并指定标题（同步调用，无返回值）
eda.sys_LoadingAndProgressBar.showProgressBar(30, '嘉立创示例 正在处理');
console.log('进度条已显示，当前进度 30%');

// 2. 重复调用刷新进度（分批任务逐步推进的典型方式）
await new Promise(r => setTimeout(r, 800));
eda.sys_LoadingAndProgressBar.showProgressBar(70, '嘉立创示例 正在处理');
console.log('进度已更新到 70%');

// 3. 进度达到 100，进度条自动销毁（自清理，无需手动 destroy）
await new Promise(r => setTimeout(r, 800));
eda.sys_LoadingAndProgressBar.showProgressBar(100, '嘉立创示例 正在处理');
console.log('进度达到 100%，进度条已自动销毁');
```

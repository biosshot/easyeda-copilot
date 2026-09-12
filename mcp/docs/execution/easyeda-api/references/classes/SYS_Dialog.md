# SYS\_Dialog class

System / dialog class

## Signature

```typescript
class SYS_Dialog
```

## Remarks

Generate dialog windows

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[createDesignPortal()](./SYS_Dialog.md)||Create a communication entry for a componentized popup window|
|[showConfirmationMessage(content, title, mainButtonTitle, buttonTitle, callbackFn)](./SYS_Dialog.md)||Show a confirmation dialog|
|[showInformationMessage(content, title, buttonTitle)](./SYS_Dialog.md)||Show an information dialog|
|[showInputDialog(beforeContent, afterContent, title, type, value, otherProperty, callbackFn)](./SYS_Dialog.md)||**_(BETA)_** Show an input dialog|
|[showSelectDialog(options, beforeContent, afterContent, title, defaultOption, multiple, callbackFn)](./SYS_Dialog.md)||**_(BETA)_** Show a select dialog|
|[showSelectDialog(options, beforeContent, afterContent, title, defaultOption, multiple, callbackFn)](./SYS_Dialog.md)||**_(BETA)_** Show a multi-select dialog|

---

## 方法详情

### createdesignportal

# SYS\_Dialog.createDesignPortal() method

Create a communication entry for a componentized popup window

## Signature

```typescript
function createDesignPortal(): IDesignPortal;
```

## Returns

[IDesignPortal](../interfaces/IDesignPortal.md)

A communication object implementing IDesignPortal

## Remarks

Returns an IDesignPortal object, used by extensions in conjunction with the VirtualRender / virtual machine component of lc-editor-design-react. All communication (sending messages + receiving events) is encapsulated inside the object.

### showconfirmationmessage

# SYS\_Dialog.showConfirmationMessage() method

Show a confirmation dialog

## Signature

```typescript
function showConfirmationMessage(
	content: string,
	title?: string,
	mainButtonTitle?: string,
	buttonTitle?: string,
	callbackFn?: (mainButtonClicked: boolean) => void,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|content|string|Message text. Line breaks can be used with `\n`|
|title|string|_(Optional)_ Popup window title|
|mainButtonTitle|string|_(Optional)_ Primary button title|
|buttonTitle|string|_(Optional)_ Primary button title|
|callbackFn|(mainButtonClicked: boolean) =&gt; void|_(Optional)_ Callback function|

## Returns

void

## Remarks

Show a window with confirmation and cancel buttons

## Example

```javascript
// 1. 弹出确认窗口，等待用户点击
eda.sys_Dialog.showConfirmationMessage(
	'即将删除选中的 3 个图元，是否继续？',
	'删除确认', // 窗口标题
	'删除', // 主按钮（确认）
	'取消', // 次按钮（取消）
	(mainButtonClicked) => {
		if (mainButtonClicked) {
			console.log('用户点击了主按钮（删除）');
		}
		else {
			console.log('用户点击了次按钮（取消）');
		}
	}
);

// 2. 窗口已弹出，本方法无返回值；回调需用户点击按钮后才会触发
console.log('已弹出确认窗口');
```


### showinformationmessage

# SYS\_Dialog.showInformationMessage() method

Show an information dialog

## Signature

```typescript
function showInformationMessage(content: string, title?: string, buttonTitle?: string): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|content|string|Message text. Line breaks can be used with `\n`|
|title|string|_(Optional)_ Popup window title|
|buttonTitle|string|_(Optional)_ Button title. If empty, the button is not displayed|

## Returns

void

## Remarks

Show a text message window

## Example

```javascript
// 1. 弹出消息窗口（content 用 \n 换行展示两行内容）
eda.sys_Dialog.showInformationMessage('DRC 检查完成\n 共检查 128 个图元，未发现违规', '检查结果', '知道了');

// 2. 窗口立即弹出；本方法无返回值，也不阻塞后续代码
console.log('已弹出消息窗口');
```


### showinputdialog

# SYS\_Dialog.showInputDialog() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Show an input dialog

## Signature

```typescript
function showInputDialog(
	beforeContent?: string,
	afterContent?: string,
	title?: string,
	type?:
		| 'color'
		| 'date'
		| 'datetime-local'
		| 'email'
		| 'mouth'
		| 'number'
		| 'password'
		| 'tel'
		| 'text'
		| 'time'
		| 'url'
		| 'week',
	value?: string | number,
	otherProperty?: {
		max?: number;
		maxlength?: number;
		min?: number;
		minlength?: number;
		multiple?: boolean;
		pattern?: RegExp;
		placeholder?: string;
		readonly?: boolean;
		step?: number;
	},
	callbackFn?: (value: any) => void,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|beforeContent|string|_(Optional)_ Text above the input box|
|afterContent|string|_(Optional)_ Text below the input box|
|title|string|_(Optional)_ Popup window title|
|type|'color' \| 'date' \| 'datetime-local' \| 'email' \| 'mouth' \| 'number' \| 'password' \| 'tel' \| 'text' \| 'time' \| 'url' \| 'week'|_(Optional)_ Input box type|
|value|string \| number|_(Optional)_ Default value of the input box|
|otherProperty|\{ max?: number; maxlength?: number; min?: number; minlength?: number; multiple?: boolean; pattern?: RegExp; placeholder?: string; readonly?: boolean; step?: number \}|_(Optional)_ Other parameters. Refer to [The HTML Input element](https://developer.mozilla.org/docs/Web/HTML/Element/input#attributes)|
|callbackFn|(value: any) =&gt; void|_(Optional)_ Callback function|

## Returns

void

The value entered by the user, always of type `string`<!-- -->, unless the user clicks the \*\*Cancel\*\* button

## Example

```javascript
// 1. 弹出数字输入窗口（默认值 5，范围 1～100）
eda.sys_Dialog.showInputDialog(
	'请输入铺铜间距', // 输入框上方文字
	'输入 1～100 之间的整数（单位 mil）', // 输入框下方文字
	'铺铜设置', // 窗口标题
	'number', // 输入类型（同 HTML input 的 type）
	5, // 默认值
	{ min: 1, max: 100, step: 1 }, // 其它输入属性（min、max、step 等）
	(value) => {
		console.log('用户输入的间距：', value);
	}
);

// 2. 窗口已弹出；回调需用户点击确认后才会触发
console.log('已弹出输入窗口');
```


### showselectdialog

# SYS\_Dialog.showSelectDialog() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Show a select dialog

## Signature

```typescript
function showSelectDialog(
	options: Array<string> | Array<{ value: string; displayContent: string }>,
	beforeContent?: string,
	afterContent?: string,
	title?: string,
	defaultOption?: string,
	multiple?: false,
	callbackFn?: (value: string) => void | Promise<void>,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|options|Array&lt;string&gt; \| Array&lt;{ value: string; displayContent: string }&gt;|Option list, which can be an array of strings or an array of objects. When `defaultOption` is not specified, the default value is the first item of the list. If it is an array of strings, the value and display content of the option remain the same. If it is an array of objects, `value` represents the value of the option, and `displayContent` represents the display content of the option|
|beforeContent|string|_(Optional)_ Text above the select box|
|afterContent|string|_(Optional)_ Text below the select box|
|title|string|_(Optional)_ Select box title|
|defaultOption|string|_(Optional)_ Default option, using the option value as the matching parameter. If the `multiple` parameter is `true`<!-- -->, an array of strings needs to be passed here|
|multiple|false|_(Optional)_ Whether multiple selection is supported. By default, it is a single-select box|
|callbackFn|(value: string) =&gt; void \| Promise&lt;void&gt;|_(Optional)_ Callback function|

## Returns

void

The value selected by the user, corresponding to the `value` field in the passed-in `options`

## Example

```javascript
// 1. 单选：对象数组让 value 与展示文案分离，默认选中 TOP
eda.sys_Dialog.showSelectDialog(
	[
		{ value: 'TOP', displayContent: '顶层' },
		{ value: 'BOTTOM', displayContent: '底层' }
	],
	'请选择丝印放置的层', // 选择框上方文字
	'设置会应用到全部丝印', // 选择框下方文字
	'丝印层设置', // 窗口标题
	'TOP', // 默认选项（匹配选项的 value）
	false, // 单选
	(value) => {
		console.log('单选结果：', value);
	}
);

// 2. 多选：字符串数组作选项，multiple 传 true，默认选中两项
eda.sys_Dialog.showSelectDialog(
	['DRC', 'BOM', 'Gerber'],
	'请选择需要导出的内容', // 多选框上方文字
	'', // 多选框下方文字
	'导出设置', // 窗口标题
	['DRC', 'BOM'], // 默认选项数组
	true, // 多选
	(values) => {
		console.log('多选结果：', values);
	}
);

// 3. 两个窗口已弹出；回调需用户点击确认后才会触发
console.log('已弹出选择窗口（单选 + 多选）');
```


### showselectdialog_1

# SYS\_Dialog.showSelectDialog() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Show a multi-select dialog

## Signature

```typescript
function showSelectDialog(
	options: Array<string> | Array<{ value: string; displayContent: string }>,
	beforeContent?: string,
	afterContent?: string,
	title?: string,
	defaultOption?: Array<string>,
	multiple?: true,
	callbackFn?: (value: Array<string>) => void | Promise<void>,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|options|Array&lt;string&gt; \| Array&lt;{ value: string; displayContent: string }&gt;|Option list, which can be an array of strings or an array of objects. When `defaultOption` is not specified, the default value is the first item of the list. If it is an array of strings, the value and display content of the option remain the same. If it is an array of objects, `value` represents the value of the option, and `displayContent` represents the display content of the option|
|beforeContent|string|_(Optional)_ Text above the multi-select box|
|afterContent|string|_(Optional)_ Text below the multi-select box|
|title|string|_(Optional)_ Multi-select box title|
|defaultOption|Array&lt;string&gt;|_(Optional)_ Default option array, using the option values as matching parameters|
|multiple|true|_(Optional)_ Whether multiple selection is supported|
|callbackFn|(value: Array&lt;string&gt;) =&gt; void \| Promise&lt;void&gt;|_(Optional)_ Callback function|

## Returns

void

Array of the set of values selected by the user, corresponding to the `value` fields in the passed-in `options`

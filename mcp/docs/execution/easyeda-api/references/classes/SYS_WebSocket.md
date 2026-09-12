# SYS\_WebSocket class

System / WebSocket class

## Signature

```typescript
class SYS_WebSocket
```

## Remarks

Interact with the WebSocket server

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[close(id, code, reason, extensionUuid)](./SYS_WebSocket.md)||Close the WebSocket connection|
|[register(id, serviceUri, receiveMessageCallFn, connectedCallFn, protocols)](./SYS_WebSocket.md)||Register a WebSocket connection|
|[send(id, data, extensionUuid)](./SYS_WebSocket.md)||Send data to the WebSocket server|

---

## 方法详情

### close

# SYS\_WebSocket.close() method

Close the WebSocket connection

## Signature

```typescript
function close(id: string, code?: number, reason?: string, extensionUuid?: string): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Custom WebSocket ID|
|code|number|_(Optional)_ Numeric status code, corresponding to the codes allowed in [WebSocket.CloseEvent](https://developer.mozilla.org/docs/Web/API/CloseEvent/code)|
|reason|string|_(Optional)_ A human-readable string explaining why the connection was closed|
|extensionUuid|string|_(Optional)_ Extension UUID. Generally it does not need to be specified. It only needs to be specified as another extension's UUID when you need to operate on a WebSocket connection established by another extension|

## Returns

void

## Remarks

Note: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

## Example

```javascript
// 1. 先注册一条连接用于演示
eda.sys_WebSocket.register('嘉立创示例_关闭', 'wss://example.com/socket', () => {}, () => {
	console.log('连接已建立');
});

// 2. 等待握手完成
await new Promise(r => setTimeout(r, 1500));

// 3. 以「正常关闭」状态码 1000 关闭连接，并附带原因
eda.sys_WebSocket.close('嘉立创示例_关闭', 1000, '演示完毕');
console.log('已关闭连接（code 1000）');
```


### register

# SYS\_WebSocket.register() method

Register a WebSocket connection

## Signature

```typescript
function register(
	id: string,
	serviceUri: string,
	receiveMessageCallFn?: (event: MessageEvent<any>) => void | Promise<void>,
	connectedCallFn?: () => void | Promise<void>,
	protocols?: string | Array<string>,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Custom WebSocket ID|
|serviceUri|string|WebSocket service URI|
|receiveMessageCallFn|(event: MessageEvent&lt;any&gt;) =&gt; void \| Promise&lt;void&gt;|_(Optional)_ Callback function when a message is received|
|connectedCallFn|() =&gt; void \| Promise&lt;void&gt;|_(Optional)_ Callback function when the connection is established|
|protocols|string \| Array&lt;string&gt;|_(Optional)_ Sub-protocols|

## Returns

void

## Remarks

It can be used to detect whether the WebSocket connection is normal before execution, but note that \*\*do not attempt connections with the same ID but different parameters\*\*, as this will cause confusion: if a WebSocket connection with the specified ID is active, changes to other parameters will not be applied

Note: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

## Example

```javascript
// 1. 注册连接，挂上「连接成功」与「收到消息」两个回调
eda.sys_WebSocket.register('嘉立创示例_注册', 'wss://example.com/socket', (event) => {
	// 服务器推送的每条消息都会进入这个回调（event.data 是消息内容）
	console.log('收到服务器消息：', event.data);
}, () => {
	console.log('连接已建立');
});

// 2. register 是同步调用，只登记意图，握手需要一点时间，等待回调触发
await new Promise(r => setTimeout(r, 1500));

// 3. 演示完毕后关闭连接，避免残留
eda.sys_WebSocket.close('嘉立创示例_注册');
console.log('已关闭连接');
```


### send

# SYS\_WebSocket.send() method

Send data to the WebSocket server

## Signature

```typescript
function send(id: string, data: string | Blob | BufferSource, extensionUuid?: string): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Custom WebSocket ID|
|data|string \| Blob \| BufferSource|Data to send|
|extensionUuid|string|_(Optional)_ Extension UUID. Generally it does not need to be specified. It only needs to be specified as another extension's UUID when you need to operate on a WebSocket connection established by another extension|

## Returns

void

## Remarks

Note: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

## Example

```javascript
// 1. 注册连接（本例的桥接服务对 ping 消息回 pong，用来演示完整收发回路）
eda.sys_WebSocket.register('嘉立创示例_发送', 'wss://example.com/socket', (event) => {
	console.log('收到服务器回复：', event.data);
}, () => {
	console.log('连接已建立');
});

// 2. 等待握手完成
await new Promise(r => setTimeout(r, 1500));

// 3. 发送数据（data 支持字符串、Blob、BufferSource，这里发 JSON 字符串）
eda.sys_WebSocket.send('嘉立创示例_发送', JSON.stringify({ type: 'ping', id: '嘉立创示例_发送' }));

// 4. 等待服务器回复进入 receiveMessageCallFn
await new Promise(r => setTimeout(r, 1500));

// 5. 演示完毕后关闭连接
eda.sys_WebSocket.close('嘉立创示例_发送');
console.log('已关闭连接');
```

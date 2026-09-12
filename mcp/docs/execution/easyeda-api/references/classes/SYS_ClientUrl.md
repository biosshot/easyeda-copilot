# SYS\_ClientUrl class

System / external request class

## Signature

```typescript
class SYS_ClientUrl
```

## Remarks

Make secure cURL requests to external servers

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[request(url, method, data, options, succeedCallFn)](./SYS_ClientUrl.md)||Make an immediate request|

---

## 方法详情

### request

# SYS\_ClientUrl.request() method

Make an immediate request

## Signature

```typescript
function request(
	url: string,
	method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH',
	data?: string | Blob | FormData | URLSearchParams,
	options?: { headers?: { [header: string]: any }; integrity?: string },
	succeedCallFn?: (data: Response) => void | Promise<void>,
): Promise<Response>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|url|string|Request URL|
|method|'GET' \| 'POST' \| 'HEAD' \| 'PUT' \| 'DELETE' \| 'PATCH'|_(Optional)_ Request method|
|data|string \| Blob \| FormData \| URLSearchParams|_(Optional)_ Data to be sent with the request, which can be direct data or a [URLSearchParams](https://developer.mozilla.org/docs/Web/API/URLSearchParams) object. If the method is `HEAD` or `GET`<!-- -->, this parameter will be ignored|
|options|\{ headers?: \{ \[header: string\]: any \}; integrity?: string \}|_(Optional)_ Request options|
|succeedCallFn|(data: Response) =&gt; void \| Promise&lt;void&gt;|_(Optional)_ Function to call back after the request succeeds|

## Returns

Promise&lt;Response&gt;

The return result of Fetch

## Remarks

Please note that the requested site must allow cross-origin resource sharing (CORS); otherwise, the API will always return an error result.

developer.mozilla.org/docs/Web/HTTP/CORS \| Cross-Origin Resource Sharing (CORS) - MDN<!-- -->}<!-- -->.

Note: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

## Example

```javascript
// 1. 发起 GET 请求（本例用本机桥接地址演示，实际使用时换成自己的服务地址）
const response = await eda.sys_ClientUrl.request('https://example.com/', 'GET');

// 2. 读取响应状态码
console.log('状态码：', response.status);

// 3. 读取响应内容（Response 是标准 fetch 返回值，用法与浏览器一致）
const body = await response.text();
console.log('响应内容：', body);
```

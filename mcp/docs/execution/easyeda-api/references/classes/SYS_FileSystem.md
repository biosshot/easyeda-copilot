# SYS\_FileSystem class

System / file system interaction class

## Signature

```typescript
class SYS_FileSystem
```

## Remarks

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[createDirectoryInFileSystem(folderPath)](./SYS_FileSystem.md)||**_(BETA)_** In file system in create folder|
|[createObjectURL(blob)](./SYS_FileSystem.md)||Create ObjectURL|
|[deleteFileInFileSystem(uri, force)](./SYS_FileSystem.md)||**_(BETA)_** Delete a file in the file system|
|[existsPathInFileSystem(uri)](./SYS_FileSystem.md)||**_(BETA)_** Check whether a file or directory exists in the file system|
|[getDocumentsPath()](./SYS_FileSystem.md)||**_(BETA)_** Get the document directory path|
|[getEdaPath()](./SYS_FileSystem.md)||**_(BETA)_** Get the EDA document directory path|
|[getExtensionFile(uri)](./SYS_FileSystem.md)||Get a file from the extension|
|[getLibrariesPaths()](./SYS_FileSystem.md)||**_(BETA)_** Get the library directory paths|
|[getProjectsPaths()](./SYS_FileSystem.md)||**_(BETA)_** Get the project directory paths|
|[listFilesOfFileSystem(folderPath, recursive)](./SYS_FileSystem.md)||**_(BETA)_** View the file list under a file system path|
|[openReadFileDialog(filenameExtensions, multiFiles)](./SYS_FileSystem.md)||**_(BETA)_** Open the read-file dialog|
|[openReadFileDialog(filenameExtensions, multiFiles)](./SYS_FileSystem.md)||**_(BETA)_** Open the read-file dialog|
|[readFileFromFileSystem(uri)](./SYS_FileSystem.md)||**_(BETA)_** Read a file from the file system|
|[revokeObjectURL(url)](./SYS_FileSystem.md)||Revoke the ObjectURL|
|[saveFile(fileData, fileName)](./SYS_FileSystem.md)||Save File|
|[saveFileToFileSystem(uri, fileData, fileName, force)](./SYS_FileSystem.md)||**_(BETA)_** Write a file to the file system|

---

## 方法详情

### createdirectoryinfilesystem

# SYS\_FileSystem.createDirectoryInFileSystem() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

In file system in create folder

## Signature

```typescript
function createDirectoryInFileSystem(folderPath: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|folderPath|string|Folder path|

## Returns

Promise&lt;boolean&gt;

Create Whether the operation is successful

## Remarks

Supports recursively creating multi-level directories

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error` ADD since EDA v3.2.166

### createobjecturl

# SYS\_FileSystem.createObjectURL() method

Create ObjectURL

## Signature

```typescript
function createObjectURL(blob: Blob | File): string;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|blob|Blob \| File|Blob or File object|

## Returns

string

ObjectURL string

## Remarks

Create an ObjectURL pointing to the passed-in Blob / File object ADD since EDA v3.2.162

## Example

```javascript
// 1. 构造一段文本数据
const blob = new Blob(['嘉立创示例数据'], { type: 'text/plain' });

// 2. 创建 ObjectURL（同步方法，直接返回字符串）
const url = eda.sys_FileSystem.createObjectURL(blob);

console.log('ObjectURL：', url);
```


### deletefileinfilesystem

# SYS\_FileSystem.deleteFileInFileSystem() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete a file in the file system

## Signature

```typescript
function deleteFileInFileSystem(uri: string, force?: boolean): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|uri|string|File resource locator. If it ends with a slash `/` (a backslash `\` on Windows), it is recognized as a folder; if it does not end with a slash, it is recognized as a complete file name, in which case the `fileName` parameter is ignored|
|force|boolean|_(Optional)_ Force delete the folder (whether to force delete the folder when the target is a folder containing files)|

## Returns

Promise&lt;boolean&gt;

Delete Whether the operation is successful

## Remarks

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### existspathinfilesystem

# SYS\_FileSystem.existsPathInFileSystem() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Check whether a file or directory exists in the file system

## Signature

```typescript
function existsPathInFileSystem(uri: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|uri|string|File resource locator. An absolute path containing the complete file name is required|

## Returns

Promise&lt;boolean&gt;

Whether the file or directory exists

## Remarks

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error` ADD since EDA v3.2.167

### getdocumentspath

# SYS\_FileSystem.getDocumentsPath() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the document directory path

## Signature

```typescript
function getDocumentsPath(): Promise<string>;
```

## Returns

Promise&lt;string&gt;

Document directory path

## Remarks

In the returned path, the end does not contain a slash `/` (or a backslash `\`<!-- -->)

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### getedapath

# SYS\_FileSystem.getEdaPath() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the EDA document directory path

## Signature

```typescript
function getEdaPath(): Promise<string>;
```

## Returns

Promise&lt;string&gt;

EDA document directory path

## Remarks

In the returned path, the end does not contain a slash `/` (or a backslash `\`<!-- -->)

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### getextensionfile

# SYS\_FileSystem.getExtensionFile() method

Get a file from the extension

## Signature

```typescript
function getExtensionFile(uri: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|uri|string|File path|

## Returns

Promise&lt;File \| undefined&gt;

File format file

## Example

```javascript
// 1. 读取扩展安装目录下的 extension.json
const file = await eda.sys_FileSystem.getExtensionFile('extension.json');

// 2. 输出文件信息（size 单位为字节，内容可用 file.text() 读取）
console.log('文件名：', file.name);
console.log('文件大小：', file.size);
```


### getlibrariespaths

# SYS\_FileSystem.getLibrariesPaths() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the library directory paths

## Signature

```typescript
function getLibrariesPaths(): Promise<Array<string>>;
```

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Array of library directory paths

## Remarks

Note 1: This API is only valid for fully offline clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### getprojectspaths

# SYS\_FileSystem.getProjectsPaths() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the project directory paths

## Signature

```typescript
function getProjectsPaths(): Promise<Array<string>>;
```

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Array of project directory paths

## Remarks

Note 1: This API is only valid for semi-offline and fully offline clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### listfilesoffilesystem

# SYS\_FileSystem.listFilesOfFileSystem() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

View the file list under a file system path

## Signature

```typescript
function listFilesOfFileSystem(
	folderPath: string,
	recursive?: boolean,
): Promise<Array<ISYS_FileSystemFileList>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|folderPath|string|Directory path|
|recursive|boolean|_(Optional)_ Whether to recursively get all sub-files|

## Returns

Promise&lt;Array&lt;[ISYS\_FileSystemFileList](../interfaces/ISYS_FileSystemFileList.md)<!-- -->&gt;&gt;

File list in the current directory

## Remarks

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### openreadfiledialog

# SYS\_FileSystem.openReadFileDialog() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Open the read-file dialog

## Signature

```typescript
function openReadFileDialog(
	filenameExtensions?: string | Array<string>,
	multiFiles?: true,
): Promise<Array<File> | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|filenameExtensions|string \| Array&lt;string&gt;|_(Optional)_ File extension|
|multiFiles|true|_(Optional)_ Whether multiple files are allowed to be read|

## Returns

Promise&lt;Array&lt;File&gt; \| undefined&gt;

File format file array

## Example

```javascript
// 1. 打开选择窗口（限定 .json 文件，单选；用户选择前 Promise 一直挂起）
eda.sys_FileSystem.openReadFileDialog('.json').then((file) => {
	// 用户完成选择后触发；直接关闭窗口时 file 为 undefined
	if (file) {
		console.log('已选择文件：', file.name);
	}
});

// 2. 窗口已弹出，主流程不等待用户操作
console.log('已打开文件选择窗口');
```


### openreadfiledialog_1

# SYS\_FileSystem.openReadFileDialog() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Open the read-file dialog

## Signature

```typescript
function openReadFileDialog(
	filenameExtensions?: string | Array<string>,
	multiFiles?: false,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|filenameExtensions|string \| Array&lt;string&gt;|_(Optional)_ File extension|
|multiFiles|false|_(Optional)_ Whether multiple files are allowed to be read|

## Returns

Promise&lt;File \| undefined&gt;

File format file

### readfilefromfilesystem

# SYS\_FileSystem.readFileFromFileSystem() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Read a file from the file system

## Signature

```typescript
function readFileFromFileSystem(uri: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|uri|string|File resource locator. An absolute path containing the complete file name is required|

## Returns

Promise&lt;File \| undefined&gt;

File format file

## Remarks

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

### revokeobjecturl

# SYS\_FileSystem.revokeObjectURL() method

Revoke the ObjectURL

## Signature

```typescript
function revokeObjectURL(url: string): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|url|string|ObjectURL string|

## Returns

void

## Remarks

Revoke the specified ObjectURL ADD since EDA v3.2.162

## Example

```javascript
// 1. 先创建一个 ObjectURL
const blob = new Blob(['嘉立创示例数据']);
const url = eda.sys_FileSystem.createObjectURL(blob);
console.log('创建的 ObjectURL：', url);

// 2. 用完后吊销（同步方法，无返回值）
eda.sys_FileSystem.revokeObjectURL(url);
console.log('已吊销');
```


### savefile

# SYS\_FileSystem.saveFile() method

Save File

## Signature

```typescript
function saveFile(fileData: File | Blob, fileName?: string): Promise<void>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileData|File \| Blob|File data|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;void&gt;

## Remarks

Calls the browser download API or the Electron save-file API to save the passed-in file stream locally

## Example

```javascript
// 1. 构造要保存的 CSV 内容
const content = '编号,器件,数量\n1,C0402,10\n2,C0603,20';
const blob = new Blob([content], { type: 'text/csv' });

// 2. 保存到本地（完成后 Promise 才结束）
await eda.sys_FileSystem.saveFile(blob, '嘉立创示例_BOM导出.csv');

console.log('已保存文件：', '嘉立创示例_BOM导出.csv', blob.size, '字节');
```


### savefiletofilesystem

# SYS\_FileSystem.saveFileToFileSystem() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Write a file to the file system

## Signature

```typescript
function saveFileToFileSystem(
	uri: string,
	fileData: File | Blob,
	fileName?: string,
	force?: boolean,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|uri|string|File resource locator. If it ends with a slash `/` (a backslash `\` on Windows), it is recognized as a folder; if it does not end with a slash, it is recognized as a complete file name, in which case the `fileName` parameter is ignored|
|fileData|File \| Blob|File data|
|fileName|string|_(Optional)_ File name|
|force|boolean|_(Optional)_ Force write (overwrite the file if it exists)|

## Returns

Promise&lt;boolean&gt;

Whether the write operation was successful. If overwriting is not allowed but the file already exists, `false` is returned

## Remarks

Note 1: This API is only valid for clients. Calling it in a browser environment will always `throw Error`

Note 2: This API requires the user to enable the extension external interaction permission, if not enabled, it will always `throw Error`

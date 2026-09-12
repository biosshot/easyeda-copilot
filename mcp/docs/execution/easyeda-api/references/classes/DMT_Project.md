# DMT\_Project class

Document tree / Project management class

## Signature

```typescript
class DMT_Project
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[createProject(projectFriendlyName, projectName, teamUuid, folderUuid, description, collaborationMode)](./DMT_Project.md)||**_(BETA)_** Create Project|
|[getAllProjectsUuid(teamUuid, folderUuid, workspaceUuid)](./DMT_Project.md)||Get the UUIDs of all projects|
|[getCurrentProjectInfo()](./DMT_Project.md)||Get detailed properties of Current project|
|[getProjectInfo(projectUuid)](./DMT_Project.md)||Get Project property|
|[moveProjectToFolder(projectUuid, folderUuid)](./DMT_Project.md)||Move a project to a folder|
|[openProject(projectUuid)](./DMT_Project.md)||Open project|

---

## 方法详情

### createproject

# DMT\_Project.createProject() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create Project

## Signature

```typescript
function createProject(
	projectFriendlyName: string,
	projectName?: string,
	teamUuid?: string,
	folderUuid?: string,
	description?: string,
	collaborationMode?: EDMT_ProjectCollaborationMode,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|projectFriendlyName|string|Project friendly name|
|projectName|string|_(Optional)_ Project name, which cannot be duplicated. Only letters `a-zA-Z`<!-- -->, digits `0-9`<!-- -->, and hyphens `-` are supported. If not specified, it is automatically generated based on the project friendly name|
|teamUuid|string|_(Optional)_ Team UUID. If not specified, it defaults to personal. In an environment where personal projects do not exist, a team UUID must be specified|
|folderUuid|string|_(Optional)_ Folder UUID. If not specified, it is the root folder|
|description|string|_(Optional)_ Project description|
|collaborationMode|[EDMT\_ProjectCollaborationMode](../enums/EDMT_ProjectCollaborationMode.md)|_(Optional)_ Project collaboration mode. If the team permission does not require the project to set a collaboration mode, this parameter will be ignored|

## Returns

Promise&lt;string \| undefined&gt;

Project UUID, if it is `undefined` creation fails

## Example

```javascript
// 1. 创建测试工程（友好名带时间戳避免重名，名称与团队留空走默认）
const projectUuid = await eda.dmt_Project.createProject(
	`嘉立创示例_工程 ${Date.now()}`,
	undefined,
	undefined,
	undefined,
	'嘉立创示例：工程创建演示',
);

// 2. 等待工作区同步后回读，确认工程已落地
await new Promise(r => setTimeout(r, 1500));
const brief = await eda.dmt_Project.getProjectInfo(projectUuid);

const folderLabel = !brief?.folderUuid ? '(根目录)' : brief.folderUuid;

console.log('projectUuid:', projectUuid);
console.log('friendlyName:', brief?.friendlyName);
console.log('folderUuid:', folderLabel);
```


### getallprojectsuuid

# DMT\_Project.getAllProjectsUuid() method

Get the UUIDs of all projects

## Signature

```typescript
function getAllProjectsUuid(
	teamUuid?: string,
	folderUuid?: string,
	workspaceUuid?: string,
): Promise<Array<string>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|teamUuid|string|_(Optional)_ Team UUID|
|folderUuid|string|_(Optional)_ Folder UUID. If not specified, it defaults to the root folder of the team|
|workspaceUuid|string|_(Optional)_ Workspace UUID|

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Project UUID array

## Remarks

If `teamUuid` is specified, all projects under the specified team are obtained;

If `folderUuid` is specified, all projects under the specified folder are obtained;

`teamUuid`<!-- -->, `folderUuid` only one of them may be specified, if both are specified, only `folderUuid`<!-- -->;

If `workspaceUuid` is specified, all projects under the specified team/folder are obtained in the specified Workspace

## Example

```javascript
// 1. 取当前工程所属团队
const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
const teamUuid = projectInfo.teamUuid;

// 2. 获取该团队下所有工程的 UUID
const projectUuids = await eda.dmt_Project.getAllProjectsUuid(teamUuid);

console.log('projectCount:', projectUuids.length);
console.log('projectUuids:', projectUuids.join(', '));
```


### getcurrentprojectinfo

# DMT\_Project.getCurrentProjectInfo() method

Get detailed properties of Current project

## Signature

```typescript
function getCurrentProjectInfo(): Promise<IDMT_ProjectItem | undefined>;
```

## Returns

Promise&lt;[IDMT\_ProjectItem](../interfaces/IDMT_ProjectItem.md) \| undefined&gt;

Project property; if it is `undefined`<!-- -->, the retrieval failed

## Remarks

It will get the detailed properties of the project associated with the currently open schematic, PCB, or panel that has the last input focus

### getprojectinfo

# DMT\_Project.getProjectInfo() method

Get Project property

## Signature

```typescript
function getProjectInfo(projectUuid: string): Promise<IDMT_BriefProjectItem | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|projectUuid|string|Project UUID|

## Returns

Promise&lt;[IDMT\_BriefProjectItem](../interfaces/IDMT_BriefProjectItem.md) \| undefined&gt;

Brief project properties. If it is `undefined`<!-- -->, the retrieval failed

## Remarks

This API can only read brief project properties. For the detailed project tree, use the [getCurrentProjectInfo](./DMT_Project.md) API

### moveprojecttofolder

# DMT\_Project.moveProjectToFolder() method

Move a project to a folder

## Signature

```typescript
function moveProjectToFolder(projectUuid: string, folderUuid?: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|projectUuid|string|Project UUID|
|folderUuid|string|_(Optional)_ Folder UUID, which can only be a folder under the team or personal space where the current project is located. If it is `undefined`<!-- -->, it is moved to the root folder of the current team|

## Returns

Promise&lt;boolean&gt;

Whether the move is successful

## Example

```javascript
// 1. 记录当前工程的位置，作为移动后恢复的锚点
const info = await eda.dmt_Project.getCurrentProjectInfo();
const projectUuid = info.uuid;
const teamUuid = info.teamUuid;
const originalFolderUuid = info.folderUuid; // 可能为 undefined（团队根目录）

// 2. 创建目标文件夹，等待 1.5s 让工作区同步
const targetFolderUuid = await eda.dmt_Folder.createFolder('嘉立创示例_目标文件夹', teamUuid);
await new Promise(r => setTimeout(r, 1500));

// 3. 把当前工程移到目标文件夹下
const moved = await eda.dmt_Project.moveProjectToFolder(projectUuid, targetFolderUuid);
await new Promise(r => setTimeout(r, 1000));

// 4. 回读验证工程已落到目标文件夹
const after = await eda.dmt_Project.getCurrentProjectInfo();
const folderChanged = after?.folderUuid === targetFolderUuid;

// 5. 恢复：移回原位置（原为根目录时传 undefined）
const restored = await eda.dmt_Project.moveProjectToFolder(projectUuid, originalFolderUuid);
await new Promise(r => setTimeout(r, 1000));

console.log('moved:', moved);
console.log('folderChanged:', folderChanged);
console.log('restored:', restored);
```


### openproject

# DMT\_Project.openProject() method

Open project

## Signature

```typescript
function openProject(projectUuid: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|projectUuid|string|Project UUID|

## Returns

Promise&lt;boolean&gt;

Whether Successful open project

## Remarks

This operation will open the specified project in the EDA front end. If another project was previously opened with unsaved changes, executing this operation will directly lose all unsaved data

## Example

```javascript
// 1. 取当前工程 UUID（打开自身，避免切换到其它工程）
const info = await eda.dmt_Project.getCurrentProjectInfo();
const projectUuid = info.uuid;

// 2. 打开该工程
const opened = await eda.dmt_Project.openProject(projectUuid);

console.log('opened:', opened);
```

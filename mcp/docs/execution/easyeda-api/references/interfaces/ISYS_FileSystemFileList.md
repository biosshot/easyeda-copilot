# ISYS\_FileSystemFileList interface

File system file path

## Signature

```typescript
interface ISYS_FileSystemFileList
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[fileName](./ISYS_FileSystemFileList.md)||string|File name (no slashes at the beginning or end)|
|[fullPath](./ISYS_FileSystemFileList.md)||string|Full path, an absolute path including the file name|
|[isDirectory](./ISYS_FileSystemFileList.md)||boolean|Whether it is a directory|
|[relativePath?](./ISYS_FileSystemFileList.md)||string|_(Optional)_ Relative path, not including the passed-in path and file name (when no path is passed in, there is no relative path), with no slashes at the beginning or end|
|[subFiles?](./ISYS_FileSystemFileList.md)||Array&lt;[ISYS\_FileSystemFileList](./ISYS_FileSystemFileList.md)<!-- -->&gt;|_(Optional)_ Sub-files of the directory|

---

## 属性详情

### filename

# ISYS\_FileSystemFileList.fileName property

File name (no slashes at the beginning or end)

## Signature

```typescript
fileName: string;
```

### fullpath

# ISYS\_FileSystemFileList.fullPath property

Full path, an absolute path including the file name

## Signature

```typescript
fullPath: string;
```

### isdirectory

# ISYS\_FileSystemFileList.isDirectory property

Whether it is a directory

## Signature

```typescript
isDirectory: boolean;
```

### relativepath

# ISYS\_FileSystemFileList.relativePath property

Relative path, not including the passed-in path and file name (when no path is passed in, there is no relative path), with no slashes at the beginning or end

## Signature

```typescript
relativePath?: string;
```

### subfiles

# ISYS\_FileSystemFileList.subFiles property

Sub-files of the directory

## Signature

```typescript
subFiles?: Array<ISYS_FileSystemFileList>;
```

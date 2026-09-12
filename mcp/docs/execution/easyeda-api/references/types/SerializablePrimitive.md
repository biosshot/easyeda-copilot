# SerializablePrimitive type

可序列化纯数据（可跨 BroadcastChannel 结构化克隆）。 编译期拒绝函数 / Date / React 元素等不可序列化值——slotProps 等跨广播字段必须用它。

## Signature

```typescript
type SerializablePrimitive = string | number | boolean | null;
```

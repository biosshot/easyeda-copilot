
class MemorizeReject extends Error { };

// Не эффективеное копирование при двух вызовах из cache
// Реализация
export function memoize<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ttlMs: number = 10 * 60 * 1000
): T {
  const cache = new Map<string, { value: ReturnType<T> | Promise<ReturnType<T>>; expiry: number; }>();

  // Очистка кэша
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiry <= now) {
        cache.delete(key);
      }
    }
  }, Math.min(ttlMs / 2, 5000)).unref();

  // Создаём мемоизированную функцию с той же сигнатурой, что и fn
  const memoizedFn = ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      if (cached.value instanceof Promise) {
        const promise = cached.value;
        // @ts-ignore
        return new Promise<ReturnType<T>>((resolve, reject) => {
          promise
            .then(result => result instanceof MemorizeReject ? resolve(memoizedFn(...args)) : resolve(structuredClone(result)))
            .catch(err => { resolve(memoizedFn(...args)) });
        });
      }
      else {
        return structuredClone(cached.value);
      }
    }

    const result = fn(...args);
    const expiry = now + ttlMs;
    const isPromise = result instanceof Promise;

    if (isPromise) {
      // Для промисов — кэшируем после разрешения
      cache.set(key, {
        value: result.then(r => structuredClone(r)).catch(e => {
          cache.delete(key);
          return new MemorizeReject();
        }), expiry
      });
    } else {
      // Для синхронных — кэшируем сразу
      cache.set(key, {
        value: structuredClone(result),
        expiry,
      });
    }

    return result;
  }) as T; // Утверждаем тип, так как сигнатура совпадает

  return memoizedFn;
}
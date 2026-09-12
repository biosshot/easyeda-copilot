// Storage adapter interface and implementations
export interface IStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}

export class LocalStorageAdapter implements IStorage {
    getItem(key: string): string | null {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
        }
        return null;
    }

    setItem(key: string, value: string): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
        }
    }

    removeItem(key: string): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
        }
    }

    clear(): void {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.clear();
        }
    }
}

// Default instance
export const defaultStorage = new LocalStorageAdapter();

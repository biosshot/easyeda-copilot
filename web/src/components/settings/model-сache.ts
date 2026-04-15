import { fetchEda } from '../../api';
import { showToastMessage } from '../../eda/utils';
import { useSettingsStore } from '../../stores/settings-store';

export interface LlmModel {
    id: string;
    name: string;
    contextLength?: number | null;
    provider?: string;
    pricing?: number;
}

type CacheKey = string;
type CacheEntry = {
    data: LlmModel[];
    timestamp: number;
};

const cache = new Map<CacheKey, CacheEntry>();
const pendingRequests = new Map<CacheKey, Promise<LlmModel[]>>();

const CACHE_TTL = 5 * 60 * 1000;

function generateKey(provider: string, baseUrl?: string, apiKey?: string): CacheKey {
    return `${provider}::${baseUrl || ''}::${apiKey || ''}`;
}

export const PROVIDER_CONFIGS = {
    openai: {
        baseUrl: () => 'https://api.openai.com/v1/',
        endpoint: 'models',
        normalize: (m: { id: string }) => ({ id: m.id, name: m.id, contextLength: null, provider: 'openai' })
    },
    openrouter: {
        baseUrl: () => 'https://openrouter.ai/api/v1',
        endpoint: 'models',
        normalize: (m: { id: string, pricing: number, name: string, context_length: number }) => ({
            id: m.id,
            name: m.name || m.id.split('/').pop(),
            contextLength: m.context_length,
            provider: 'openrouter',
            pricing: m.pricing
        })
    },
    anthropic: {
        staticModels: [
            { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextLength: 1000000 },
            { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', contextLength: 1000000 },
            { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', contextLength: 200000 },
            { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextLength: 200000 },

            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextLength: 1000000 },
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextLength: 1000000 },
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextLength: 1000000 },

            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextLength: 200000 },
        ]
    },
    deepseek: {
        baseUrl: () => 'https://api.deepseek.com',
        endpoint: 'models',
        normalize: (m: { id: string }) => ({ id: m.id, name: m.id, contextLength: null, provider: 'deepseek' })
    },
    ollamacloud: {
        baseUrl: () => 'https://ollama.com/v1/',
        endpoint: 'models',
        normalize: (m: { id: string }) => ({ id: m.id, name: m.id, contextLength: null, provider: 'ollama' })
    },
    zai: {
        baseUrl: () => 'https://open.bigmodel.cn/api/paas/v4/',
        endpoint: 'models',
        normalize: (m: { id: string }) => ({ id: m.id, name: m.id, contextLength: null, provider: 'zai' })
    },
    kimi: {
        baseUrl: () => 'https://api.moonshot.ai/v1/',
        endpoint: 'models',
        normalize: (m: { id: string }) => ({ id: m.id, name: m.id, contextLength: null, provider: 'kimi' })
    },
    local: {
        baseUrl: () => {
            const settings = useSettingsStore();
            return String(settings.getSetting('llmBaseUrl'))
        },
        endpoint: 'models',
        normalize: (m: { id: string }) => ({ id: m.id, name: m.id, contextLength: null, provider: 'local' })
    },
}


export async function fetchModelsCached(
    provider: string,
    baseUrl?: string,
    apiKey?: string
): Promise<LlmModel[]> {
    const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS];
    if (!config) return [];

    if ('staticModels' in config) {
        return [...config.staticModels];
    }

    if (!apiKey && provider !== 'local') return [];

    const key = generateKey(provider, baseUrl, apiKey);

    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!;
    }

    const requestPromise = (async () => {
        try {
            const base = baseUrl || config.baseUrl();

            const safeBase = base.endsWith('/') ? base : `${base}/`;
            const url = new URL(config.endpoint, safeBase).href;

            const res = await fetchEda(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            const data = json.data || json.models || [];
            const normalized = data.map(config.normalize);

            cache.set(key, {
                data: normalized,
                timestamp: Date.now()
            });

            return normalized;
        } catch (err) {
            showToastMessage(`Failed to fetch models for ${provider}: ` + (err as Error).message, 'warn');
            throw err;
        } finally {
            pendingRequests.delete(key);
        }
    })();

    pendingRequests.set(key, requestPromise);
    return requestPromise;
}
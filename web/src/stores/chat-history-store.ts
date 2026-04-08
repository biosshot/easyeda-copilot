import { defineStore } from 'pinia';
import { ref, computed, type Ref, toRaw } from 'vue';
import AppDBClient, { type AppDBDocument } from 'appdb';
import { defaultStorage } from './storage';
import { AttachmentFileSchema, type AttachmentFile } from '../utils/file-parser';
import { z } from 'zod';

export const ChatMessageSchema = z.object({
    _id: z.string().optional(),
    role: z.enum(['human', 'ai']),
    isReady: z.boolean().optional(),
    content: z.string(),
    thinking: z.string().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    attachments: z.array(AttachmentFileSchema).optional(),
    checkpoint: z.string().optional()
});

export interface ChatMessage {
    _id?: string;
    role: 'human' | 'ai';
    isReady?: boolean;
    content: string;
    thinking?: string;
    options?: Record<string, unknown>;
    attachments?: AttachmentFile[];
    checkpoint?: string
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    cachedFiles?: string[];
}

interface ChatSessionDocument extends ChatSession, AppDBDocument {
    _id: string;
    type: 'session';
}

interface ChatMetaDocument extends AppDBDocument {
    _id: 'current_chat_id';
    type: 'meta';
    value: string | null;
}

const CHAT_DB_NAME = 'chat_history';
const CHAT_STORE_NAME = 'chat_history';
const LEGACY_STORAGE_KEY = 'chat_history';
const LEGACY_CURRENT_CHAT_KEY = 'current_chat_id';

const chatDbClient = new AppDBClient(false);
const chatDbPromise = chatDbClient.init(CHAT_DB_NAME, {
    [CHAT_STORE_NAME]: ['_id', 'type', 'id', 'title', 'createdAt', 'updatedAt', 'value']
});

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((message) => ({
        ...message,
        options: message.options ? { ...message.options } : undefined,
        attachments: message.attachments ? message.attachments.map((attachment) => ({ ...attachment })) : undefined
    }));
}

export const useChatHistoryStore = defineStore('chatHistory', () => {
    const chatSessions = ref<Map<string, ChatSession>>(new Map());
    const currentChatId = ref<string | null>(null);
    let hydrationPromise: Promise<void> | null = null;

    let cachedFilesStore: Promise<Cache | null>;

    try {
        cachedFilesStore = caches.open('easyeda-copilot-files').catch(_ => null);
    } catch (error) {
        cachedFilesStore = Promise.resolve(null);
    }

    async function persistState() {
        try {
            const db = await chatDbPromise;

            const sessions = Array.from(chatSessions.value.values()).map(toRaw);
            const sessionById = new Set(sessions.map((session) => session.id));

            const existingSessions = await db[CHAT_STORE_NAME].find({ type: 'session' }).catch(() => []) as ChatSessionDocument[];

            for (const existing of existingSessions) {
                if (!sessionById.has(existing.id)) {
                    await db[CHAT_STORE_NAME].remove({ _id: existing._id }).catch(() => null);
                }
            }

            for (const session of sessions) {
                const doc: ChatSessionDocument = {
                    ...session,
                    _id: session.id,
                    type: 'session'
                };
                await db[CHAT_STORE_NAME].insert(doc);
            }

            const meta: ChatMetaDocument = {
                _id: 'current_chat_id',
                type: 'meta',
                value: currentChatId.value
            };
            await db[CHAT_STORE_NAME].insert(meta);
        } catch (e) {
            console.error('Failed to save chat history to AppDB:', e);
        }
    }

    async function migrateLegacyStorageIfNeeded() {
        try {
            const data = defaultStorage.getItem(LEGACY_STORAGE_KEY);
            if (!data) return;

            const sessions: ChatSession[] = JSON.parse(data);
            chatSessions.value = new Map(sessions.map((session) => {
                return [session.id, session];
            }));

            const savedCurrentId = defaultStorage.getItem(LEGACY_CURRENT_CHAT_KEY);
            if (savedCurrentId && chatSessions.value.has(savedCurrentId)) {
                currentChatId.value = savedCurrentId;
            } else if (chatSessions.value.size > 0) {
                currentChatId.value = Array.from(chatSessions.value.keys())[0];
            } else {
                currentChatId.value = null;
            }

            await persistState();

            // defaultStorage.removeItem(LEGACY_STORAGE_KEY);
            // defaultStorage.removeItem(LEGACY_CURRENT_CHAT_KEY);
        } catch (e) {
            console.error('Failed to migrate chat history from localStorage:', e);
        }
    }

    async function hydrateState() {
        try {
            const db = await chatDbPromise;

            const sessions = await db[CHAT_STORE_NAME].find({ type: 'session' }).catch(() => []) as ChatSessionDocument[];

            if (sessions.length === 0) {
                await migrateLegacyStorageIfNeeded();
                return;
            }

            chatSessions.value = new Map(
                sessions.map((session) => {
                    const { _id, type, ...chat } = session;
                    return [chat.id, chat as ChatSession];
                })
            );

            const meta = await db[CHAT_STORE_NAME]
                .find({ _id: 'current_chat_id' })
                .then(r => r[0])
                .catch(() => null) as ChatMetaDocument | null;

            const savedCurrentId = meta?.value;
            if (savedCurrentId && chatSessions.value.has(savedCurrentId)) {
                currentChatId.value = savedCurrentId;
            } else if (chatSessions.value.size > 0) {
                currentChatId.value = Array.from(chatSessions.value.keys())[0];
            } else {
                currentChatId.value = null;
            }
        } catch (e) {
            console.error('Failed to load chat history from AppDB:', e);
            await migrateLegacyStorageIfNeeded();
        }
    }

    // Load from storage on initialization
    function loadFromStorage() {
        if (!hydrationPromise) {
            hydrationPromise = hydrateState();
        }
    }

    // Save to storage
    function saveToStorage() {
        persistState();
    }

    // Create new chat session
    function createNewChat(initialMessages: ChatMessage[] = []): string {
        let id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const title = generateChatTitle(initialMessages);

        let emptyChat: string | undefined = undefined;

        chatSessions.value.forEach((chat) => {
            if (chat.messages.length === 0) {
                emptyChat = chat.id;
            }
        });

        if (emptyChat) {
            id = emptyChat;
        }

        console.log('Creating new chat session with ID:', id);

        const session: ChatSession = {
            id,
            title,
            messages: [
                ...initialMessages,
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cachedFiles: []
        };

        chatSessions.value.set(id, session);
        currentChatId.value = id;
        saveToStorage();

        return id;
    }

    // Get current chat session
    function getCurrentChat(): ChatSession | null {
        if (!currentChatId.value) {
            createNewChat();
        }

        return chatSessions.value.get(currentChatId.value ?? '') || null;
    }

    // Get all chat sessions (sorted by most recent first)
    function getAllChats(): ChatSession[] {
        return Array.from(chatSessions.value.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt
        );
    }

    // Switch to a specific chat
    function switchToChat(id: string): boolean {
        if (!chatSessions.value.has(id)) {
            return false;
        }
        currentChatId.value = id;
        saveToStorage();
        return true;
    }

    // Delete a chat session
    async function deleteChat(id: string): Promise<boolean> {
        const chat = chatSessions.value.get(id);
        if (!chat) return false;

        const deleted = chatSessions.value.delete(id);

        if (deleted) {
            const store = await cachedFilesStore;
            if (store) {
                for (const file of chat.cachedFiles ?? []) {
                    await store.delete(file).catch(e => {
                        console.error('Failed to delete cached file:', file, e);
                    })
                }
            }

            // If deleted chat was current, switch to another or clear
            if (currentChatId.value === id) {
                const remaining = Array.from(chatSessions.value.keys());
                currentChatId.value = remaining.length > 0 ? remaining[0] : null;
            }
            saveToStorage();
        }

        return deleted;
    }

    // Add message to current chat
    function addMessageToCurrentChat(message: ChatMessage): boolean {
        const chat = getCurrentChat();
        if (!chat) return false;

        if (chat.title === 'New Chat') {
            chat.title = generateChatTitle(chat.messages);
        }

        chat.messages.push(message);
        chat.updatedAt = Date.now();
        saveToStorage();

        return true;
    }

    function setMessagesToCurrentChat(message: ChatMessage[]): boolean {
        const chat = getCurrentChat();
        if (!chat) return false;

        if (chat.title === 'New Chat') {
            chat.title = generateChatTitle(chat.messages);
        }

        chat.messages = message;
        chat.updatedAt = Date.now();
        saveToStorage();

        return true;
    }

    // Add cached file to current chat
    async function addCachedFile(filename: string, blob: Blob) {
        const chat = getCurrentChat();
        if (chat && chat.cachedFiles && !chat.cachedFiles.includes(filename)) {
            chat.cachedFiles.push(filename);
            const store = await cachedFilesStore;

            if (store) {
                store.put(filename, new Response(blob)).catch(e => {
                    console.error('Failed to cache file:', filename, e);
                }).then(() => {
                    console.log('Cached file:', filename);
                });
            }

            saveToStorage();
        }
    }

    async function readCachedFile(filename: string): Promise<Blob | null> {
        const store = await cachedFilesStore;

        if (store) {
            return store.match(filename).then(response => response ? response.blob() : null).catch(() => null);
        }

        return null
    }

    // Update chat title
    function updateChatTitle(id: string, title: string): boolean {
        const chat = chatSessions.value.get(id);
        if (!chat) return false;
        if (chat.title === title) return false;

        chat.title = title;
        chat.updatedAt = Date.now();
        saveToStorage();

        return true;
    }

    // Duplicate chat session
    function duplicateChat(id: string): string | null {
        const source = chatSessions.value.get(id);
        if (!source) return null;

        const newId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const duplicated: ChatSession = {
            id: newId,
            title: `${source.title} (copy)`,
            messages: cloneMessages(source.messages),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cachedFiles: [...(source.cachedFiles ?? [])]
        };

        chatSessions.value.set(newId, duplicated);
        currentChatId.value = newId;
        saveToStorage();

        return newId;
    }

    // Clear all chat history
    async function clearAllChats(): Promise<void> {
        // Delete all cached files
        const store = await cachedFilesStore;

        if (store) {
            for (const chat of chatSessions.value.values()) {
                for (const file of chat.cachedFiles ?? []) {
                    await store.delete(file).catch(e => {
                        console.error('Failed to delete cached file:', file, e);
                    })
                }
            }
        }

        chatSessions.value.clear();
        currentChatId.value = null;
        saveToStorage();
    }

    // Check if current chat is empty
    function isCurrentChatEmpty(): boolean {
        const chat = getCurrentChat();
        return !chat || chat.messages.length === 0;
    }

    // Generate chat title from messages
    function generateChatTitle(messages: ChatMessage[]): string {
        if (messages.length === 0) return 'New Chat';

        // Find first human message and extract first words
        const firstHuman = messages.find(m => m.role === 'human');
        if (firstHuman && firstHuman.content) {
            const words = firstHuman.content.split(/\s+/).slice(0, 5).join(' ');
            return words.length > 30 ? words.slice(0, 30) + '...' : words || 'New Chat';
        }

        return 'New Chat';
    }

    // Initialize on store creation
    loadFromStorage();

    return {
        chatSessions: computed(() => chatSessions.value),
        currentChatId: computed(() => currentChatId.value),
        getCurrentChat,
        getAllChats,
        createNewChat,
        switchToChat,
        deleteChat,
        addMessageToCurrentChat,
        setMessagesToCurrentChat,
        addCachedFile,
        readCachedFile,
        updateChatTitle,
        duplicateChat,
        clearAllChats,
        isCurrentChatEmpty,
        loadFromStorage,
        saveToStorage,
    };
});

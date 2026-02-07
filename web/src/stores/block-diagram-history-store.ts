import { defineStore } from 'pinia';
import { defaultStorage } from './storage';
import type { FlowImportObject } from '@vue-flow/core';

export interface BlockDiagramEntry {
    id: string;
    name: string;
    data: FlowImportObject;
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEY = 'block-diagram-history';
const MAX_HISTORY_ITEMS = 20;

export const useBlockDiagramHistoryStore = defineStore('block-diagram-history', {
    state: () => ({
        history: [] as BlockDiagramEntry[],
    }),

    getters: {
        getHistory(): BlockDiagramEntry[] {
            return this.history.sort((a, b) => b.updatedAt - a.updatedAt);
        },

        getHistoryById(): (id: string) => BlockDiagramEntry | undefined {
            return (id: string) => this.history.find(item => item.id === id);
        }
    },

    actions: {
        initializeHistory() {
            const stored = defaultStorage.getItem(STORAGE_KEY);
            if (stored) {
                try {
                    this.history = JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to parse block diagram history:', e);
                    this.history = [];
                }
            }
        },

        addOrUpdateEntry(name: string, data: FlowImportObject) {
            const existingIndex = this.history.findIndex(item => item.name === name);
            const now = Date.now();

            if (existingIndex !== -1) {
                // Update existing entry
                this.history[existingIndex] = {
                    ...this.history[existingIndex],
                    data,
                    updatedAt: now
                };
            } else {
                // Add new entry
                const newEntry: BlockDiagramEntry = {
                    id: `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name,
                    data,
                    createdAt: now,
                    updatedAt: now
                };
                this.history.unshift(newEntry);
            }

            // Keep only the last MAX_HISTORY_ITEMS
            if (this.history.length > MAX_HISTORY_ITEMS) {
                this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
            }

            this.saveToStorage();
        },

        removeEntry(id: string) {
            this.history = this.history.filter(item => item.id !== id);
            this.saveToStorage();
        },

        renameEntry(id: string, newName: string) {
            const entry = this.history.find(item => item.id === id);
            if (entry) {
                entry.name = newName;
                entry.updatedAt = Date.now();
                this.saveToStorage();
            }
        },

        clearHistory() {
            this.history = [];
            defaultStorage.removeItem(STORAGE_KEY);
        },

        saveToStorage() {
            try {
                defaultStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
            } catch (e) {
                console.error('Failed to save block diagram history:', e);
            }
        }
    }
});

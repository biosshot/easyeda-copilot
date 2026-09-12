import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
    state: () => ({
        activeTab: 'chat',
    }),
    actions: {
        setActiveTab(tab: string) {
            this.activeTab = tab;
        },
    }
});
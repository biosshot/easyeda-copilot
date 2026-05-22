<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { connectMcp, disconnectMcp, onMcpLog, onMcpState, type McpConnectionState, type McpLog } from './mcp-client';
import { useSettingsStore } from './stores/settings-store';

const settingsStore = useSettingsStore();

const state = ref<McpConnectionState>('disconnected');
const logs = ref<McpLog[]>([]);

const statusLabel = computed(() => {
    if (state.value === 'connected') return 'Connected';
    if (state.value === 'connecting') return 'Connecting';
    if (state.value === 'error') return 'Connection error';
    return 'Disconnected';
});

const statusClass = computed(() => `status ${state.value}`);

let removeStateListener: (() => void) | undefined;
let removeLogListener: (() => void) | undefined;

onMounted(() => {
    removeStateListener = onMcpState(nextState => {
        state.value = nextState;
    });
    removeLogListener = onMcpLog(log => {
        logs.value = [log, ...logs.value].slice(0, 20);
    });
    connectMcp();
});

onUnmounted(() => {
    settingsStore.loadSettings();
    removeStateListener?.();
    removeLogListener?.();
    disconnectMcp();
});
</script>

<template>
    <main class="mcp-window">
        <header>
            <div>
                <h1>MCP</h1>
                <p>EasyEDA bridge</p>
            </div>
            <span :class="statusClass">{{ statusLabel }}</span>
        </header>

        <section class="controls">
            <button type="button" @click="connectMcp">Connect</button>
            <button type="button" @click="disconnectMcp">Disconnect</button>
        </section>

        <section class="log">
            <div v-for="log in logs" :key="`${log.timestamp}-${log.event}`" class="log-row">
                <time>{{ new Date(log.timestamp).toLocaleTimeString() }}</time>
                <strong>{{ log.event }}</strong>
                <span>{{ log.message }}</span>
            </div>
            <div v-if="logs.length === 0" class="empty">Waiting for events</div>
        </section>
    </main>
</template>

<style scoped>
.mcp-window {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 14px;
    color: #20252d;
    background: #f6f7f9;
    font-family: Inter, Arial, sans-serif;
}

header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

h1 {
    margin: 0;
    font-size: 18px;
    line-height: 1.1;
}

p {
    margin: 3px 0 0;
    color: #687080;
    font-size: 12px;
}

.status {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 8px;
    border: 1px solid #c9ced6;
    border-radius: 6px;
    background: #ffffff;
    font-size: 12px;
    white-space: nowrap;
}

.status.connected {
    border-color: #2e7d54;
    color: #1f6b45;
    background: #edf8f1;
}

.status.connecting {
    border-color: #9b6b21;
    color: #805415;
    background: #fff6e8;
}

.status.error {
    border-color: #b64c4c;
    color: #963535;
    background: #fff0f0;
}

.controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
}

button {
    height: 32px;
    border: 1px solid #bfc5cf;
    border-radius: 6px;
    background: #ffffff;
    color: #20252d;
    font-size: 13px;
    cursor: pointer;
}

button:hover {
    background: #eef1f5;
}

.log {
    overflow: auto;
    max-height: calc(100vh - 112px);
    border: 1px solid #d8dde5;
    border-radius: 8px;
    background: #ffffff;
}

.log-row {
    display: grid;
    grid-template-columns: 64px 120px 1fr;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid #edf0f4;
    font-size: 12px;
}

.log-row:last-child {
    border-bottom: 0;
}

time {
    color: #687080;
}

strong {
    overflow: hidden;
    text-overflow: ellipsis;
    color: #343a44;
    white-space: nowrap;
}

.empty {
    padding: 18px 8px;
    color: #687080;
    text-align: center;
    font-size: 12px;
}
</style>

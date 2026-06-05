<template>
    <div class="pcb-viewer">
        <div class="header">
            <div>
                <h3>PCB board assemble</h3>
                <p class="subtitle">{{ summaryText }}</p>
            </div>
            <IconButton class="assemble-button" variant="primary" icon="Play" @click="assembleBoardHandler">
                Assemble PCB
            </IconButton>
        </div>

        <div class="stats-grid">
            <div class="stat">
                <span class="stat-value">{{ boardPointCount }}</span>
                <span class="stat-label">Board points</span>
            </div>
            <div class="stat">
                <span class="stat-value">{{ components.length }}</span>
                <span class="stat-label">Components</span>
            </div>
            <div class="stat">
                <span class="stat-value">{{ tracks.length }}</span>
                <span class="stat-label">Tracks</span>
            </div>
            <div class="stat">
                <span class="stat-value">{{ vias.length }}</span>
                <span class="stat-label">Vias</span>
            </div>
            <div class="stat">
                <span class="stat-value">{{ polygons.length }}</span>
                <span class="stat-label">Fills</span>
            </div>
        </div>

        <Collapsible v-if="warnings.length" class="section">
            <template #title>
                <span class="collapsible-title warning">{{ warnings.length }} Warnings</span>
            </template>
            <ul class="message-list">
                <li v-for="(warning, index) in warnings" :key="index">{{ warning }}</li>
            </ul>
        </Collapsible>

        <Collapsible v-if="components.length" class="section">
            <template #title>
                <span class="collapsible-title">{{ components.length }} Components</span>
            </template>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Designator</th>
                            <th>Layer</th>
                            <th>X</th>
                            <th>Y</th>
                            <th>Rot</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="component in components" :key="component.designator">
                            <td class="strong">{{ component.designator }}</td>
                            <td>{{ component.layer }}</td>
                            <td>{{ formatMm(component.x) }}</td>
                            <td>{{ formatMm(component.y) }}</td>
                            <td>{{ formatDeg(component.rotate) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Collapsible>

        <Collapsible v-if="tracks.length" class="section">
            <template #title>
                <span class="collapsible-title">{{ tracks.length }} Tracks</span>
            </template>
            <div class="item-grid">
                <div v-for="(track, index) in tracks" :key="index" class="item-card">
                    <div class="item-head">
                        <span class="strong">{{ track.net }}</span>
                        <span class="pill">{{ track.layer }}</span>
                    </div>
                    <div class="item-meta">
                        <span>{{ track.points.length }} points</span>
                        <span>{{ formatMm(track.width) }} width</span>
                    </div>
                </div>
            </div>
        </Collapsible>

        <Collapsible v-if="vias.length" class="section">
            <template #title>
                <span class="collapsible-title">{{ vias.length }} Vias</span>
            </template>
            <div class="item-grid">
                <div v-for="(via, index) in vias" :key="index" class="item-card">
                    <div class="item-head">
                        <span class="strong">{{ via.net || 'mechanical' }}</span>
                    </div>
                    <div class="item-meta">
                        <span>{{ formatMm(via.x) }}, {{ formatMm(via.y) }}</span>
                        <span>drill {{ formatMm(via.drill) }}</span>
                        <span>dia {{ formatMm(via.diameter) }}</span>
                    </div>
                </div>
            </div>
        </Collapsible>

        <Collapsible v-if="polygons.length" class="section">
            <template #title>
                <span class="collapsible-title">{{ polygons.length }} Copper fills</span>
            </template>
            <div class="item-grid">
                <div v-for="(polygon, index) in polygons" :key="index" class="item-card">
                    <div class="item-head">
                        <span class="strong">{{ polygon.net }}</span>
                        <span class="pill">{{ polygon.layer }}</span>
                    </div>
                    <div class="item-meta">
                        <span>{{ polygon.points.length }} points</span>
                    </div>
                </div>
            </div>
        </Collapsible>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { BoardAssemble } from '@copilot/shared/types/pcb/board-assemble'
import Collapsible from '../../shared/Collapsible.vue'
import IconButton from '../../shared/IconButton.vue'
import { InlineButton } from '../../../types/inline-button'
import { assembleBoard } from '../../../eda/assemble-board'

const props = defineProps<{ result: { pcb?: BoardAssemble } | BoardAssemble }>()
const emit = defineEmits<{ 'inline-buttons': [InlineButton[]] }>()

const board = computed(() => ('pcb' in props.result ? props.result.pcb : props.result) ?? {})
const components = computed(() => board.value.components ?? [])
const tracks = computed(() => board.value.tracks ?? [])
const vias = computed(() => board.value.vias ?? [])
const polygons = computed(() => board.value.polygons ?? [])
const warnings = computed(() => board.value.warnings ?? [])
const boardPointCount = computed(() => board.value.board?.polygon?.length ?? 0)

const summaryText = computed(() => {
    const parts = [
        `${components.value.length} components`,
        `${tracks.value.length} tracks`,
        `${vias.value.length} vias`,
        `${polygons.value.length} fills`,
    ]
    return parts.join(' · ')
})

const formatMm = (value: number) => `${formatNumber(value)} mm`
const formatDeg = (value: number) => `${formatNumber(value)} deg`
const formatNumber = (value: number) => {
    const rounded = Math.round((Number(value) || 0) * 1000) / 1000
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

const assembleBoardHandler = async () => {
    await assembleBoard(board.value as BoardAssemble)
}

onMounted(() => {
    emit('inline-buttons', [{
        icon: 'Play',
        text: 'Assemble PCB',
        handler: () => assembleBoardHandler(),
    }])
})
</script>

<style scoped>
.pcb-viewer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.75rem;
}

h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.05rem;
}

.subtitle {
    margin: 0.25rem 0 0;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
}

.assemble-button {
    padding-right: 1rem;
    white-space: nowrap;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.5rem;
}

.stat,
.item-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    padding: 0.65rem;
}

.stat-value {
    display: block;
    color: var(--color-primary);
    font-weight: 700;
    font-size: 1rem;
}

.stat-label,
.item-meta {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

.section {
    margin-top: 0.1rem;
}

.collapsible-title {
    color: var(--color-text-primary);
    font-size: 0.85rem;
    font-weight: 600;
}

.collapsible-title.warning {
    color: #d29922;
}

.message-list {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--color-text-secondary);
}

.table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
}

th,
td {
    border: 1px solid var(--color-border);
    padding: 0.35rem 0.5rem;
    text-align: left;
    white-space: nowrap;
}

th {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
    font-weight: 600;
}

.strong {
    color: var(--color-text-primary);
    font-weight: 600;
}

.item-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 0.5rem;
}

.item-head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.35rem;
}

.item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.pill {
    color: var(--color-primary);
    background: var(--color-primary-subtle);
    border-radius: 0.25rem;
    padding: 0.1rem 0.4rem;
    font-size: 0.7rem;
}
</style>

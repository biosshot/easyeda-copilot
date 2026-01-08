<template>
    <div class="circuit-agent-result">
        <div class="circuit-result-container">
            <!-- Левая часть: информация о проекте и блоки -->
            <div class="circuit-info">
                <div class="project-header">
                    <div class="project-header-top">
                        <IconButton class="assemble-button" @click="assembleCircuitHandler" icon="Play">
                            Assebmle circuit
                        </IconButton>

                        <div style="word-wrap: break-word;">
                            <h3 class="project-name">{{ result?.circuit?.metadata?.project_name || 'Untitled Project' }}
                            </h3>
                            <pre class="project-description">{{ result?.circuit?.metadata?.description }}</pre>
                        </div>

                    </div>
                </div>

                <!-- Блоки схемы -->
                <div v-if="result?.circuit?.blocks?.length" class="blocks-section">
                    <h3>Structural blocks</h3>
                    <div class="blocks-grid">
                        <div v-for="block in result.circuit.blocks" :key="block.name" class="block-card">
                            <div class="block-header">
                                <span class="block-name">{{ block.name }}</span>
                            </div>
                            <pre class="block-description">{{ block.description }}</pre>
                            <div v-if="block.next_block_names?.length" class="next-blocks">
                                <span class="label">Related blocks:</span>
                                <div class="tags">
                                    <span v-for="nextBlock in block.next_block_names" :key="nextBlock" class="tag">
                                        {{ nextBlock }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Компоненты -->
                <div v-if="result?.circuit?.components?.length" class="components-section">
                    <h3>Components ({{ components.length }})</h3>
                    <div class="components-list">
                        <div v-for="(component, idx) in components" :key="idx" class="component-item">
                            <div class="component-header">
                                <span class="designator">{{ component.designator }}</span>
                                <span class="value">{{ component.value }}</span>
                            </div>
                            <div class="component-details">
                                <div class="detail-row">
                                    <span class="label">Block:</span>
                                    <span class="value">{{ component.block_name }}</span>
                                </div>
                                <div v-if="component.search_query" class="detail-row">
                                    <span class="label">Request:</span>
                                    <span class="value">{{ component.search_query }}</span>
                                </div>
                                <div v-if="component.part_uuid" class="detail-row">
                                    <span class="label">UUID:</span>
                                    <span class="value uuid">{{ component.part_uuid }}</span>
                                </div>
                            </div>
                            <div v-if="component.pins?.length" class="pins-section">
                                <table class="pins-table">
                                    <thead>
                                        <tr>
                                            <th>Pin</th>
                                            <th>Name</th>
                                            <th>Signal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="pin in component.pins"
                                            :key="`${component.designator}-${pin.pin_number}`">
                                            <td class="pin-number">{{ pin.pin_number }}</td>
                                            <td class="pin-name">{{ pin.name }}</td>
                                            <td class="pin-signal">{{ pin.signal_name }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Правая часть: структурная схема в PDF -->
            <div v-if="result?.blockDiagram" class="pdf-section">
                <h3>Block diagram</h3>
                <PdfFileViewer :result="result.blockDiagram" />
            </div>

            <div class="project-footer">
                <IconButton class="assemble-button" @click="assembleCircuitHandler" icon="Play">
                    Assebmle circuit
                </IconButton>
            </div>
        </div>
    </div>
</template>

<script setup>
import { defineProps } from 'vue'
import PdfFileViewer from './PdfFileViewer.vue'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'

const props = defineProps({
    result: {
        type: Object,
        required: true
    }
})

const components = props.result?.circuit?.components?.filter?.(comp => !['GND', 'VCC'].includes(comp.part_uuid)) || [];

const assembleCircuitHandler = async () => {
    if (typeof window.eda !== 'undefined') {
        await window.eda.assembleCircuit(props.result.circuit);
    }
}
</script>

<style scoped>
.circuit-agent-result {
    /* padding: 1.5rem; */
    /* background: var(--color-background-secondary); */
    /* border-radius: 0.5rem; */
    /* border: 1px solid var(--color-border); */
}

.circuit-result-container {
    display: flex;
    flex-direction: column;
}

/* === Информация о проекте === */
.circuit-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-width: 0;
}

.project-footer {
    padding-top: 1rem;
}


.project-header {
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1rem;
}

.project-header-top {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.assemble-button {
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: .375rem;
    cursor: pointer;
    font-weight: 500;
    font-size: .9rem;
    white-space: nowrap;
    transition: background-color .2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.5rem;
    padding-right: 1rem;
}

.assemble-button:hover {
    background: var(--color-primary-hover, var(--color-primary));
    opacity: 0.9;
}

.assemble-button:active {
    transform: scale(0.98);
}

.project-name {
    margin: 0 0 0.5rem 0;
    /* font-size: 1.5rem; */
    color: var(--color-text-primary);
    /* max-width: 90%; */
}

.project-description {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    margin: 0;
    padding: 0;
}

/* === Блоки === */
.blocks-section h3,
.components-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    color: var(--color-text-primary);
}

.blocks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    max-height: 250px;
    overflow-y: auto;
}

.block-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    padding: 1rem;
    transition: background-color 0.2s;
}

.block-card:hover {
    background: var(--color-surface-hover);
}

.block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.block-name {
    font-weight: 600;
    color: var(--color-primary);
    font-size: 0.95rem;
}

.block-description {
    background: transparent;
    border: none;
    margin: 0;
    padding: 0;
}

.next-blocks {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
}

.next-blocks .label {
    display: block;
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    margin-bottom: 0.5rem;
}

.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.tag {
    display: inline-block;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
}

/* === Компоненты === */
.components-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    max-height: 250px;
    overflow-y: auto;
    padding-right: 0.5rem;
}

.component-item {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    padding: 0.75rem;
    transition: background-color 0.2s;
}

.component-item:hover {
    background: var(--color-surface-hover);
}

.component-header {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    align-items: baseline;
}

.designator {
    font-weight: 600;
    color: var(--color-text-primary);
    min-width: 50px;
}

.component-header .value {
    color: var(--color-primary);
    font-size: 0.9rem;
}

.component-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
}

.detail-row {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: 0.5rem;
    align-items: center;
}

.detail-row .label {
    color: var(--color-text-tertiary);
    font-weight: 500;
}

.detail-row .value {
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.uuid {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
}

.pins-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
    margin-top: 0.5rem;
}

.pins-label {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    font-weight: 500;
}

.pins-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-top: 0.5rem;
}

.pins-table th,
.pins-table td {
    border: 1px solid var(--color-border);
    padding: 0.25rem 0.5rem;
    text-align: left;
}

.pins-table th {
    background: var(--color-background-secondary);
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.75rem;
}

.pins-table td.pin-number {
    font-weight: 600;
    color: var(--color-primary);
}

.pins-table td.pin-name {
    color: var(--color-text-primary);
}

.pins-table td.pin-signal {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

/* === PDF секция === */
.pdf-section {
    min-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 15px;
}

.pdf-section h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-text-primary);
}

@media (max-width: 1200px) {
    .pdf-section {
        min-width: unset;
    }
}
</style>

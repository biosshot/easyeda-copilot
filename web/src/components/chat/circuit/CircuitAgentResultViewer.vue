<template>
    <div class="circuit-agent-result">
        <div class="circuit-result-container">
            <!-- Левая часть: информация о проекте и блоки -->
            <div class="circuit-info">
                <div class="project-header">
                    <div class="project-header-top">
                        <div style="word-wrap: break-word;">
                            <h3 class="project-name">{{ result?.circuit?.metadata?.project_name || 'Untitled Project' }}
                            </h3>
                            <pre class="project-description">{{ result?.circuit?.metadata?.description }}</pre>
                        </div>

                    </div>
                </div>

                <!-- Блоки схемы -->
                <Collapsible v-if="result?.circuit?.blocks?.length" class="blocks-section">
                    <template #title>
                        <span class="custom-collapsible-title">
                            <span class="label">{{ result.circuit.blocks.length }} Structural blocks</span>
                        </span>
                    </template>

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
                </Collapsible>

                <!-- Компоненты -->
                <Collapsible v-if="components.length" class="components-section">
                    <template #title>
                        <span class="custom-collapsible-title add">
                            <span class="symbol">+{{ components.length }}</span>
                            <span class="label">Components</span>
                        </span>
                    </template>
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
                </Collapsible>

                <!-- Removed components -->
                <Collapsible v-if="result?.circuit?.rm_components?.length" class="rm-components-section">
                    <template #title>
                        <span class="custom-collapsible-title minus">
                            <span class="symbol">-{{ result.circuit.rm_components.length }}</span>
                            <span class="label">Removed components</span>
                        </span>
                    </template>
                    <div class="rm-components-list">
                        <div v-for="(component, idx) in result.circuit.rm_components" :key="idx"
                            class="component-item-simple">
                            <span class="designator">{{ component }}</span>
                        </div>
                    </div>
                </Collapsible>

                <!-- Added nets -->
                <Collapsible v-if="result?.circuit?.added_net?.length" class="added-net-section">
                    <template #title>
                        <span class="custom-collapsible-title add">
                            <span class="symbol">+{{ result.circuit.added_net.length }}</span>
                            <span class="label">Added nets</span>
                        </span>
                    </template>
                    <div class="added-net-list">
                        <div v-for="(net, idx) in result.circuit.added_net" :key="idx" class="net-item">
                            <div class="net-header">
                                <span class="designator">{{ net.designator }}</span>
                                <span class="pin-number">Pin {{ net.pin_number }}</span>
                                <span class="net-name">{{ net.net }}</span>
                            </div>
                        </div>
                    </div>
                </Collapsible>

                <!-- Rm nets -->
                <Collapsible v-if="result?.circuit?.rm_net?.length" class="added-net-section">
                    <template #title>
                        <span class="custom-collapsible-title minus">
                            <span class="symbol">-{{ result.circuit.rm_net.length }}</span>
                            <span class="label">Remove nets</span>
                        </span>
                    </template>
                    <div class="added-net-list">
                        <div v-for="(net, idx) in result.circuit.rm_net" :key="idx" class="net-item">
                            <div class="net-header">
                                <span class="designator">{{ net.designator }}</span>
                                <span class="pin-number">Pin {{ net.pin_number }}</span>
                                <span class="net-name">{{ net.net }}</span>
                            </div>
                        </div>
                    </div>
                </Collapsible>


                <!-- Replaced components -->
                <Collapsible v-if="result?.circuit?.replace_components?.length" class="replace-components-section">
                    <template #title>
                        <span class="custom-collapsible-title">
                            <span class="label">{{ result.circuit.replace_components.length }} Replaced
                                components</span>
                        </span>
                    </template>

                    <div class="replace-components-list">
                        <div v-for="(component, idx) in result.circuit.replace_components" :key="idx"
                            class="component-item-simple">
                            <span class="designator">{{ component }}</span>
                        </div>
                    </div>
                </Collapsible>
            </div>

            <Collapsible v-if="result?.blockDiagram" class="pdf-section">
                <template #title>
                    <span class="custom-collapsible-title">
                        <span class="label">Block diagram</span>
                    </span>
                </template>

                <div class="pdf-section">
                    <PdfFileViewer :result="result.blockDiagram" />
                </div>
            </Collapsible>

            <div class="project-footer">
                <IconButton class="assemble-button" variant="primary" @click="assembleCircuitHandler" icon="Play">
                    Assemble circuit
                </IconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import PdfFileViewer from '../pdf/PdfFileViewer.vue'
import Collapsible from '../../shared/Collapsible.vue'
import IconButton from '../../shared/IconButton.vue'
import { onMounted } from 'vue'
import { InlineButton } from '../../../types/inline-button'
import { assembleCircuit } from '../../../eda/assemble-circuit'
import { CircuitAssembly } from '@copilot/shared/types/circuit'

const props = defineProps<{ result: { circuit: CircuitAssembly, blockDiagram?: string } }>()

const emit = defineEmits<{ 'inline-buttons': [InlineButton[]] }>();

const components = props.result?.circuit?.components?.filter?.((comp) => !['GND', 'VCC'].includes(comp.part_uuid!) && !comp.designator.includes('|')) || [];

const assembleCircuitHandler = async () => {
    assembleCircuit(props.result.circuit);
}

onMounted(() => {
    emit('inline-buttons', [{
        icon: 'Play',
        text: 'Assemble circuit',
        handler: () => assembleCircuitHandler()
    }])
})
</script>

<style scoped>
.circuit-result-container {
    display: flex;
    flex-direction: column;
}

/* === Информация о проекте === */
.circuit-info {
    display: flex;
    flex-direction: column;
    /* gap: 0.5rem; */
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
    padding-right: 1rem;
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
.blocks-section,
.components-section {
    margin-top: 0.1rem;
}

.blocks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
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

.rm-components-section,
.added-net-section,
.pdf-section,
.replace-components-section {
    margin-top: 0.1rem;
}

.added-net-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.net-item {
    background: var(--color-background);
    padding: 0.1rem;
    transition: background-color 0.2s;
}

.net-item:hover {
    background: var(--color-surface-hover);
}

.net-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.9rem;
}

.net-header .designator {
    font-weight: 600;
    color: var(--color-text-primary);
    min-width: 50px;
}

.net-header .pin-number {
    color: var(--color-primary);
    font-size: 0.85rem;
}

.net-header .net-name {
    color: var(--color-text-secondary);
}

.rm-components-list,
.replace-components-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.component-item-simple {
    background: var(--color-background);
    padding: 0.1rem;
    transition: background-color 0.2s;
}

.custom-collapsible-title {
    font-size: 0.85rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.custom-collapsible-title .symbol {
    font-weight: 700;
}

.custom-collapsible-title.add {
    color: #2cbe4e;
    /* GitHub green */
}

.custom-collapsible-title.minus {
    color: #cb2431;
    /* GitHub red */
}

.custom-collapsible-title .label {
    color: var(--color-text-primary);
}

.component-item-simple:hover {
    background: var(--color-surface-hover);
}

.component-item-simple .designator {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.95rem;
}

@media (max-width: 1200px) {
    .pdf-section {
        min-width: unset;
    }
}
</style>

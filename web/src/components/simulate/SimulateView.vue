<template>
    <div class="simulate-view-container">
        <div v-if="!isSettingsOpen" class="container">
            <IconButton variant="primary" class="simulate" icon="Play" @click="openSettings">Run spice simulate with
                selected</IconButton>
        </div>

        <div v-else class="settings-full-page">
            <div v-if="errorMessage" style="padding: 15px;">
                <ErrorBanner :message="errorMessage" :type="errorType" />
            </div>

            <Stepper :steps="steps" :finish-button-text="isRunning ? 'Stop' : 'Run simulate'"
                :finish-button-icon="isRunning ? 'Square' : 'Play'"
                @finish="isRunning ? stopSimulation() : runSimulation()">
                <StepPanels>
                    <StepPanel :value="0">
                        <div class="settings-content">
                            <div class="sources-section">
                                <div class="section-header">
                                    <h3>Input Sources</h3>
                                    <!-- <IconButton icon="Plus" :size="16" variant="primary"
                                        @click="autoDetectInputSources">Auto
                                        detect</IconButton> -->
                                    <IconButton icon="Plus" :size="16" variant="primary" @click="addInputSource">Add
                                        Input Source</IconButton>
                                </div>

                                <div v-if="inputSources.length === 0" class="empty-list">
                                    No input sources added. Click "Add Input Source" to begin.
                                </div>

                                <div v-for="(source, index) in inputSources" :key="source.id" class="source-item">
                                    <div class="source-header">
                                        <span class="source-label">Source {{ index + 1 }}</span>
                                        <IconButton variant="remove" icon="Trash2" :size="16"
                                            @click="removeInputSource(source.id)"></IconButton>
                                    </div>

                                    <div class="source-content">
                                        <div class="form-group">
                                            <NetInput v-model="source.signalName" />
                                        </div>
                                        <div class="form-group">
                                            <label>Signal Type</label>
                                            <CustomSelect :model-value="source.type" :options="[
                                                { label: 'DC', value: 'dc' },
                                                { label: 'Sine', value: 'sin' },
                                                { label: 'Pulse', value: 'pulse' },
                                                { label: 'Saw', value: 'saw' },
                                                { label: 'Reverse Saw', value: 'rsaw' },
                                            ]" @update:model-value="updateSourceType(source.id, $event)" />
                                        </div>

                                        <div v-if="source.type === 'dc'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`dc-voltage-${source.id}`">Voltage (V)</label>

                                                <UnitInput :id="`dc-voltage-${source.id}`" variant="voltage"
                                                    v-model="source.amplitude" placeholder="0" />
                                            </div>
                                        </div>

                                        <div v-if="source.type === 'sin'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`sin-amplitude-${source.id}`">Amplitude (V)</label>
                                                <UnitInput :id="`sin-amplitude-${source.id}`" variant="voltage"
                                                    v-model="source.amplitude" placeholder="1" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-offset-${source.id}`">Offset (V)</label>
                                                <UnitInput :id="`sin-offset-${source.id}`" variant="voltage"
                                                    v-model="source.offset" placeholder="0" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-frequency-${source.id}`">Frequency (Hz)</label>
                                                <UnitInput :id="`sin-frequency-${source.id}`" variant="freq"
                                                    v-model="source.frequency" />
                                            </div>
                                        </div>

                                        <div v-if="source.type === 'pulse'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`sin-amplitude-${source.id}`">Amplitude (V)</label>
                                                <UnitInput :id="`sin-amplitude-${source.id}`" variant="voltage"
                                                    v-model="source.amplitude" placeholder="1" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-offset-${source.id}`">Offset (V)</label>
                                                <UnitInput :id="`sin-offset-${source.id}`" variant="voltage"
                                                    v-model="source.offset" placeholder="0" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-frequency-${source.id}`">Frequency (Hz)</label>
                                                <UnitInput :id="`sin-frequency-${source.id}`" variant="freq"
                                                    v-model="source.frequency" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-fill-${source.id}`">Fill (%)</label>
                                                <input type="number" :id="`sin-frequency-${source.id}`"
                                                    v-model="source.fill">
                                            </div>
                                        </div>

                                        <div v-if="source.type === 'saw'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`sin-amplitude-${source.id}`">Amplitude (V)</label>
                                                <UnitInput :id="`sin-amplitude-${source.id}`" variant="voltage"
                                                    v-model="source.amplitude" placeholder="1" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-offset-${source.id}`">Offset (V)</label>
                                                <UnitInput :id="`sin-offset-${source.id}`" variant="voltage"
                                                    v-model="source.offset" placeholder="0" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-frequency-${source.id}`">Frequency (Hz)</label>
                                                <UnitInput :id="`sin-frequency-${source.id}`" variant="freq"
                                                    v-model="source.frequency" />
                                            </div>
                                        </div>

                                        <div v-if="source.type === 'rsaw'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`sin-amplitude-${source.id}`">Amplitude (V)</label>
                                                <UnitInput :id="`sin-amplitude-${source.id}`" variant="voltage"
                                                    v-model="source.amplitude" placeholder="1" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-offset-${source.id}`">Offset (V)</label>
                                                <UnitInput :id="`sin-offset-${source.id}`" variant="voltage"
                                                    v-model="source.offset" placeholder="0" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-frequency-${source.id}`">Frequency (Hz)</label>
                                                <UnitInput :id="`sin-frequency-${source.id}`" variant="freq"
                                                    v-model="source.frequency" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </StepPanel>

                    <StepPanel :value="1">
                        <div class="settings-content">
                            <div class="outputs-section">
                                <div class="section-header">
                                    <h3>Output Signals</h3>
                                    <IconButton icon="Plus" :size="16" variant="primary" @click="addOutputSignal">Add
                                        Output Signal</IconButton>
                                </div>

                                <div v-if="outputSignals.length === 0" class="empty-list">
                                    No output signals added. Click "Add Output Signal" to begin.
                                </div>

                                <div v-for="(signal, index) in outputSignals" :key="signal.id" class="output-item">
                                    <div class="output-header">
                                        <span class="output-label">Output {{ index + 1 }}</span>
                                        <IconButton variant="remove" icon="Trash2" :size="16"
                                            @click="removeOutputSignal(signal.id)"></IconButton>
                                    </div>
                                    <div class="output-content">
                                        <NetInput v-model="signal.name" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </StepPanel>

                    <StepPanel :value="2">
                        <div class="settings-content">
                            <div class="settings-section">
                                <div class="section-header">
                                    <h3>Simulation Settings</h3>
                                </div>

                                <div class="settings-form">
                                    <div class="form-group">
                                        <label for="simulation-type">Simulation Type</label>
                                        <CustomSelect :model-value="simulationType" :options="[
                                            { label: 'Transient (TRAN)', value: 'tran' }
                                        ]" @update:model-value="simulationType = $event" />
                                    </div>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="step-time">Step Time</label>
                                            <UnitInput id="step-time" variant="time" v-model="stepTime"
                                                placeholder="1" />
                                        </div>

                                        <div class="form-group">
                                            <label for="end-time">End Time</label>
                                            <UnitInput id="end-time" variant="time" v-model="endTime" placeholder="5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </StepPanel>

                    <StepPanel :value="3">
                        <div class="settings-content">
                            <div class="results-header">
                                <h3>Simulation Results</h3>
                                <IconButton :size="18" icon="ExternalLink" variant="primary"
                                    @click="openGraphInNewWindow" title="Open in new window" />
                            </div>

                            <TypingDots v-if="isRunning" status="Running simulation..." />

                            <div v-else-if="simulationResult" class="results-content">
                                <VoltageChart style="height: 400px;" ref="voltageChartRefs"
                                    :time="simulationResult.time" :signals="simulationResult.signals">
                                </VoltageChart>
                            </div>

                            <div v-else class="no-results">
                                <p>No simulation results yet. Click "Run Simulation" to start.</p>
                            </div>
                        </div>
                    </StepPanel>
                </StepPanels>
            </Stepper>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import IconButton from '../shared/IconButton.vue';
import CustomSelect from '../shared/CustomSelect.vue';
import ErrorBanner from '../shared/ErrorBanner.vue';
import Stepper from '../shared/Stepper.vue';
import { apiUrl, fetchEda, fetchWithTask } from '../../api';
import VoltageChart from '../shared/VoltageChart.vue';
import { getSchematic } from '../../eda/schematic';
import StepPanel from '../shared/StepPanel.vue';
import StepPanels from '../shared/StepPanels.vue';
import TypingDots from '../shared/TypingDots.vue';
import NetInput from '../shared/NetInput.vue';
import UnitInput, { UnitValue } from '../shared/UnitInput.vue';
import { showToastMessage } from '../../eda/utils';

interface InputSource {
    id: string;
    type: 'dc' | 'sin' | 'pulse' | 'saw' | 'triangle' | 'rsaw';
    signalName: string;
    amplitude: UnitValue | undefined;
    offset: UnitValue | undefined;
    frequency: UnitValue | undefined;
    fill: number | undefined;
}

interface OutputSignal {
    id: string;
    name: string;
}

interface SimulationResult {
    time: number[],
    signals: { data: number[]; name: string }[]
}

declare global {
    interface EDA {
        chartData?: {
            time: number[];
            signals: { data: number[]; name: string }[];
        };
    }
}

const isSettingsOpen = ref(false);
const isRunning = ref(false);
const simulationResult = ref<SimulationResult | null>(null);
const syncGraphsByTime = ref(false);
const errorMessage = ref<string | null>(null);
const errorType = ref<'error' | 'warn'>('error');
const inputSources = ref<InputSource[]>([]);
const outputSignals = ref<OutputSignal[]>([]);
const abortController = ref<AbortController | undefined>();

const simulationType = ref<'tran'>('tran');
const stepTime = ref<UnitValue>({ unit: 'u', value: 100 });
const endTime = ref<UnitValue>({ unit: 'm', value: 10 });

watchEffect(() => {
    console.log(stepTime.value)
})

const steps = [
    { id: 'sources', label: 'Input Sources' },
    { id: 'outputs', label: 'Output Signals' },
    { id: 'settings', label: 'Simulation Settings' },
    { id: 'results', label: 'Results' }
];

const openSettings = () => {
    isSettingsOpen.value = true;
    simulationResult.value = null;
    errorMessage.value = null;
};

const generateId = (): string => {
    return `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const addInputSource = () => {
    const amplitude: UnitValue = { unit: 'base', value: 12 };
    const offset: UnitValue = { unit: 'base', value: 0 };
    const frequency: UnitValue = { unit: 'base', value: 100 };

    inputSources.value.push({
        id: generateId(),
        type: 'dc',
        signalName: '',
        amplitude: amplitude,
        offset: offset,
        frequency: frequency,
        fill: 50
    });
};

const removeInputSource = (id: string) => {
    inputSources.value = inputSources.value.filter(s => s.id !== id);
};

const updateSourceType = (id: string, type: 'dc' | 'sin') => {
    const source = inputSources.value.find(s => s.id === id);
    if (source) {
        source.type = type;
    }
};

const addOutputSignal = () => {
    outputSignals.value.push({
        id: generateId(),
        name: ''
    });
};

const removeOutputSignal = (id: string) => {
    outputSignals.value = outputSignals.value.filter(s => s.id !== id);
};

const stopSimulation = () => {
    abortController.value?.abort();
}

const openGraphInNewWindow = async () => {
    if (!simulationResult.value) {
        showToastMessage('No simulation data to display', 'error');
        return;
    }

    await eda.sys_IFrame.openIFrame(
        '/iframe/graph.html',
        800,
        600,
        undefined,
        {
            maximizeButton: true,
            minimizeButton: true,
            grayscaleMask: false
        }
    );
};

const runSimulation = async () => {
    if (isRunning.value) return;

    isRunning.value = true;
    errorMessage.value = null;

    const controller = new AbortController();
    abortController.value = controller;

    try {
        const body = {
            step_time_ns: stepTime.value?.valueInUnits?.n ?? 100000,
            end_time_ns: endTime.value?.valueInUnits?.n ?? 100000 * 100,
            output_signals: outputSignals.value.map(s => s.name),
            input_signals: inputSources.value.map((source, index) => ({
                name: `INPUT_${index}`,
                signal_name: source.signalName,
                value: source.amplitude?.valueInUnits?.base ?? 1,
                frequency: source.frequency?.valueInUnits?.base ?? 1000,
                offset: source.offset?.valueInUnits?.base ?? 0,
                type: source.type.toUpperCase(),
                fill: source.fill ?? 50
            })),
            components: (await getSchematic()).components
        };

        const response = await fetchWithTask({
            url: '/v1/simulate',
            fetchOptions: { signal: controller.signal },
            body: body,
            pollIntervalMs: 1000
        });

        const json = response as {
            status: string,
            error: string | null,
            result: {
                time: number[],
                output_signals: {
                    signal_name: string,
                    volages: number[]
                }[]
            }
        };

        if (json.error) {
            throw new Error(json.error);
        }

        simulationResult.value = {
            time: json.result.time,
            signals: json.result.output_signals.map(sign => ({
                data: sign.volages,
                name: sign.signal_name
            }))
        };

        // Сохраняем данные в eda для открытия в новом окне
        eda.chartData = simulationResult.value;
    } catch (error) {
        errorMessage.value = error instanceof Error
            ? error.message
            : 'An unexpected error occurred during simulation';
        errorType.value = 'error';
        simulationResult.value = null;
    } finally {
        isRunning.value = false;
    }
};

</script>

<style scoped>
.simulate-view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}

.container {
    display: flex;
    justify-content: center;
    height: 100%;
    align-items: center;
}

.settings-full-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}

.settings-content {
    max-width: 800px;
    margin: 0 auto;
}

.sources-section,
.outputs-section {
    margin-bottom: 2rem;
}

.sources-section:last-child,
.outputs-section:last-child {
    margin-bottom: 0;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.section-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text);
    font-weight: 600;
}

.empty-list {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.9rem;
    background: var(--color-background);
    border-radius: 6px;
    border: 1px dashed var(--color-border);
}

.source-item,
.output-item {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 1.25rem;
    margin-bottom: 1rem;
}

.source-item:last-child,
.output-item:last-child {
    margin-bottom: 0;
}

.source-header,
.output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.source-label,
.output-label {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.9rem;
}

.form-group {
    margin-bottom: 1rem;
}

.form-group:last-child {
    margin-bottom: 0;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.85rem;
}

.settings-section {
    margin-bottom: 2rem;
}

.settings-section:last-child {
    margin-bottom: 0;
}

.settings-form {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 1.25rem;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.form-group input[type="text"],
.form-group input[type="number"] {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text);
    font-size: 0.9rem;
    box-sizing: border-box;
    transition: border-color 0.2s;
}

.form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.form-group input::placeholder {
    color: var(--color-text-tertiary);
}

.source-content,
.output-content {
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
}

.results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.results-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-text);
    font-weight: 600;
}

.no-results {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-tertiary);
}

.results-content {
    animation: fadeIn 0.3s ease;
}

.sync-checkbox {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.95rem;
}

.sync-checkbox label {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color-text);
}

.sync-checkbox input[type="checkbox"] {
    width: auto;
    margin-right: 0.5rem;
    cursor: pointer;
}
</style>

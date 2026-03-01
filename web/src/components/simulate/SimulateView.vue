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

            <Stepper :steps="steps" finish-button-text="Run simulate" finish-button-icon="Play" @finish="runSimulation">
                <StepPanels>
                    <StepPanel :value="0">
                        <div class="settings-content">
                            <div class="sources-section">
                                <div class="section-header">
                                    <h3>Input Sources</h3>
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
                                                { label: 'Sine', value: 'sin' }
                                            ]" @update:model-value="updateSourceType(source.id, $event)" />
                                        </div>

                                        <div v-if="source.type === 'dc'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`dc-voltage-${source.id}`">Voltage (V)</label>

                                                <UnitInput :id="`dc-voltage-${source.id}`" variant="voltage"
                                                    v-model="source.dcVoltage" placeholder="0" />
                                            </div>
                                        </div>

                                        <div v-if="source.type === 'sin'" class="source-fields">
                                            <div class="form-group">
                                                <label :for="`sin-amplitude-${source.id}`">Amplitude (V)</label>
                                                <UnitInput :id="`sin-amplitude-${source.id}`" variant="voltage"
                                                    v-model="source.sinAmplitude" placeholder="1" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-offset-${source.id}`">Offset (V)</label>
                                                <UnitInput :id="`sin-offset-${source.id}`" variant="voltage"
                                                    v-model="source.sinOffset" placeholder="0" />
                                            </div>
                                            <div class="form-group">
                                                <label :for="`sin-frequency-${source.id}`">Frequency (Hz)</label>
                                                <UnitInput :id="`sin-frequency-${source.id}`" variant="freq"
                                                    v-model="source.sinFrequency" />
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
                            <div class="results-section">
                                <div class="results-header">
                                    <h3>Simulation Results</h3>
                                </div>

                                <div class="sync-checkbox">
                                    <label>
                                        <input type="checkbox" v-model="syncGraphsByTime" />
                                        Sync graphs by time
                                    </label>
                                </div>

                                <TypingDots v-if="isRunning" status="Running simulation..." />

                                <div v-else-if="simulationResults" class="results-content">
                                    <div v-for="(output_signal, index) in simulationResults.result.output_signals"
                                        :key="output_signal.signal_name">
                                        <span>{{ output_signal.signal_name }}</span>
                                        <VoltageChart ref="voltageChartRefs" :time="simulationResults.result.time"
                                            :data="output_signal.volages" :sync-time="syncGraphsByTime"
                                            @sync-zoom="(s, e) => handleSyncZoom(index)(s, e)">
                                        </VoltageChart>
                                    </div>
                                </div>

                                <div v-else class="no-results">
                                    <p>No simulation results yet. Click "Run Simulation" to start.</p>
                                </div>
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
import { apiUrl, fetchEda } from '../../api';
import VoltageChart from '../shared/VoltageChart.vue';
import { getSchematic } from '../../eda/schematic';
import StepPanel from '../shared/StepPanel.vue';
import StepPanels from '../shared/StepPanels.vue';
import TypingDots from '../shared/TypingDots.vue';
import NetInput from '../shared/NetInput.vue';
import UnitInput, { UnitValue } from '../shared/UnitInput.vue';

interface InputSource {
    id: string;
    type: 'dc' | 'sin';
    signalName: string;
    dcVoltage: UnitValue | undefined;
    sinAmplitude: UnitValue | undefined;
    sinOffset: UnitValue | undefined;
    sinFrequency: UnitValue | undefined;
}

interface OutputSignal {
    id: string;
    name: string;
}

interface SimulationResults {
    result: {
        time: number[],
        output_signals: {
            signal_name: string,
            volages: number[]
        }[]
    },
    status: string;
    timestamp: string;
}

const isSettingsOpen = ref(false);
const isRunning = ref(false);
const simulationResults = ref<SimulationResults | null>(null);
const syncGraphsByTime = ref(false);
const voltageChartRefs = ref<InstanceType<typeof VoltageChart>[]>([]);
const errorMessage = ref<string | null>(null);
const errorType = ref<'error' | 'warn'>('error');

// const generateFakeSineData = (points: number = 1_500_000, frequency: number = 2 * Math.PI / 100, amplitude: number = 1, offset: number = 0) => {
//     const time: number[] = [];
//     const voltages: number[] = [];

//     for (let i = 0; i < points; i++) {
//         time.push(i);
//         voltages.push(amplitude * Math.sin(frequency * i) + offset);
//     }

//     return { time, voltages };
// };

// const fakeData = ref(generateFakeSineData());

const inputSources = ref<InputSource[]>([]);
const outputSignals = ref<OutputSignal[]>([]);

const simulationType = ref<'tran'>('tran');
const stepTime = ref<UnitValue>();
const endTime = ref<UnitValue>();

watchEffect(() => {
    console.log(stepTime.value)
})

const handleSyncZoom = (sourceIndex: number) => {
    return (start: number, end: number) => {
        if (!syncGraphsByTime.value) return;

        // Синхронизируем все графики кроме того, который инициировал зум
        voltageChartRefs.value.forEach((chart, index) => {
            if (index !== sourceIndex && chart?.handleExternalSync) {
                chart.handleExternalSync(start, end);
            }
        });
    };
}

const steps = [
    { id: 'sources', label: 'Input Sources' },
    { id: 'outputs', label: 'Output Signals' },
    { id: 'settings', label: 'Simulation Settings' },
    { id: 'results', label: 'Results' }
];

const openSettings = () => {
    isSettingsOpen.value = true;
    simulationResults.value = null;
    errorMessage.value = null;
};

const generateId = (): string => {
    return `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const addInputSource = () => {
    inputSources.value.push({
        id: generateId(),
        type: 'dc',
        signalName: '',
        dcVoltage: undefined,
        sinAmplitude: undefined,
        sinOffset: undefined,
        sinFrequency: undefined
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

const runSimulation = async () => {
    if (isRunning.value) return;

    isRunning.value = true;
    errorMessage.value = null;
    try {

        const body = {
            step_time_ns: stepTime.value?.valueInUnits.n ?? 100000,
            end_time_ns: endTime.value?.valueInUnits.n ?? 100000 * 100,
            output_signals: outputSignals.value.map(s => s.name),
            input_signals: inputSources.value.map((source, index) => ({
                name: source.type === 'dc' ? `INPUT_${index}` : `INPUT_${index}`,
                signal_name: source.signalName,
                value: source.type === 'dc'
                    ? source.dcVoltage?.valueInUnits.base ?? 0
                    : source.sinAmplitude?.valueInUnits.base ?? 1,
                frequency: source.type === 'sin'
                    ? source.sinFrequency?.valueInUnits.base ?? 1000
                    : 0,
                offset: source.type === 'sin'
                    ? source.sinOffset?.valueInUnits.base ?? 0
                    : 0,
                type: source.type.toUpperCase()
            })),
            components: (await getSchematic()).components
        };

        const response = await fetchEda(apiUrl + '/v1/simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        const json = await response.json() as {
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

        simulationResults.value = {
            result: json.result,
            status: 'Completed',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        errorMessage.value = error instanceof Error
            ? error.message
            : 'An unexpected error occurred during simulation';
        errorType.value = 'error';
        simulationResults.value = null;
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

.results-section {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1.5rem;
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

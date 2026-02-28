<template>
    <div class="simulate-view-container">
        <div v-if="!isSettingsOpen" class="container">
            <IconButton class="simulate" icon="Play" @click="openSettings">Run spice simulate with selected</IconButton>
        </div>

        <div v-else class="settings-full-page">
            <!-- Stepper -->
            <div class="stepper-container">
                <div v-for="(step, index) in steps" :key="step.id" class="step-item" :class="{
                    'step-active': currentStep === index,
                    'step-completed': currentStep > index
                }">
                    <div class="step-circle" @click="goToStep(index)">
                        <span class="step-number">{{ index + 1 }}</span>
                    </div>
                    <span class="step-label">{{ step.label }}</span>
                </div>
            </div>

            <!-- Контент шагов -->
            <div class="settings-body">
                <div class="settings-content">
                    <!-- Шаг 1: Input Sources -->
                    <div v-if="currentStep === 0" class="step-content">
                        <div class="sources-section">
                            <div class="section-header">
                                <h3>Input Sources</h3>
                                <button class="add-button" @click="addInputSource">
                                    <Icon name="Plus" size="16" />
                                    Add Input Source
                                </button>
                            </div>

                            <div v-if="inputSources.length === 0" class="empty-list">
                                No input sources added. Click "Add Input Source" to begin.
                            </div>

                            <div v-for="(source, index) in inputSources" :key="source.id" class="source-item">
                                <div class="source-header">
                                    <span class="source-label">Source {{ index + 1 }}</span>
                                    <button class="remove-button" @click="removeInputSource(source.id)">
                                        <Icon name="Trash2" size="16" />
                                    </button>
                                </div>

                                <div class="source-content">
                                    <div class="form-group">
                                        <label>Signal Type</label>
                                        <CustomSelect :model-value="source.type" :options="[
                                            { label: 'DC', value: 'dc' },
                                            { label: 'Sine', value: 'sin' }
                                        ]" @update:model-value="updateSourceType(source.id, $event)" />
                                    </div>

                                    <!-- Поля для DC -->
                                    <div v-if="source.type === 'dc'" class="source-fields">
                                        <div class="form-group">
                                            <label :for="`dc-voltage-${source.id}`">Voltage (V)</label>
                                            <input :id="`dc-voltage-${source.id}`" type="number"
                                                v-model.number="source.dcVoltage" placeholder="0" step="any" />
                                        </div>
                                    </div>

                                    <!-- Поля для SIN -->
                                    <div v-if="source.type === 'sin'" class="source-fields">
                                        <div class="form-group">
                                            <label :for="`sin-amplitude-${source.id}`">Amplitude (V)</label>
                                            <input :id="`sin-amplitude-${source.id}`" type="number"
                                                v-model.number="source.sinAmplitude" placeholder="1" step="any" />
                                        </div>
                                        <div class="form-group">
                                            <label :for="`sin-offset-${source.id}`">Offset (V)</label>
                                            <input :id="`sin-offset-${source.id}`" type="number"
                                                v-model.number="source.sinOffset" placeholder="0" step="any" />
                                        </div>
                                        <div class="form-group">
                                            <label :for="`sin-frequency-${source.id}`">Frequency (Hz)</label>
                                            <input :id="`sin-frequency-${source.id}`" type="number"
                                                v-model.number="source.sinFrequency" placeholder="1000" step="any" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Шаг 2: Output Signals -->
                    <div v-if="currentStep === 1" class="step-content">
                        <div class="outputs-section">
                            <div class="section-header">
                                <h3>Output Signals</h3>
                                <button class="add-button" @click="addOutputSignal">
                                    <Icon name="Plus" size="16" />
                                    Add Output Signal
                                </button>
                            </div>

                            <div v-if="outputSignals.length === 0" class="empty-list">
                                No output signals added. Click "Add Output Signal" to begin.
                            </div>

                            <div v-for="(signal, index) in outputSignals" :key="signal.id" class="output-item">
                                <div class="output-header">
                                    <span class="output-label">Output {{ index + 1 }}</span>
                                    <button class="remove-button" @click="removeOutputSignal(signal.id)">
                                        <Icon name="Trash2" size="16" />
                                    </button>
                                </div>
                                <div class="output-content">
                                    <div class="form-group">
                                        <label :for="`output-name-${signal.id}`">Signal Name / Node</label>
                                        <input :id="`output-name-${signal.id}`" type="text" v-model="signal.name"
                                            placeholder="e.g., V(out), I(R1)" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Шаг 3: Simulation Results -->
                    <div v-if="currentStep === 2" class="step-content results-step">
                        <div class="results-section">
                            <div class="results-header">
                                <h3>Simulation Results</h3>
                            </div>

                            <div v-if="isRunning" class="loading-state">
                                <div class="spinner"></div>
                                <p>Running simulation...</p>
                            </div>

                            <div v-else-if="simulationResults" class="results-content">
                                <div class="result-summary">
                                    <div class="summary-card">
                                        <span class="summary-label">Input Sources</span>
                                        <span class="summary-value">{{ simulationResults.inputSourcesCount }}</span>
                                    </div>
                                    <div class="summary-card">
                                        <span class="summary-label">Output Signals</span>
                                        <span class="summary-value">{{ simulationResults.outputSignalsCount }}</span>
                                    </div>
                                    <div class="summary-card">
                                        <span class="summary-label">Status</span>
                                        <span class="summary-value status-success">{{ simulationResults.status }}</span>
                                    </div>
                                </div>

                                <div class="results-actions">

                                </div>
                            </div>

                            <div v-else class="no-results">
                                <p>No simulation results yet. Click "Run Simulation" to start.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Навигация -->
            <div class="settings-footer">
                <button v-if="currentStep > 0" class="back-button" @click="prevStep">
                    <Icon name="ArrowLeft" size="16" />
                    Back
                </button>
                <div class="footer-spacer"></div>
                <button v-if="currentStep < steps.length - 1" class="next-button" @click="nextStep">
                    Next
                    <Icon name="ArrowRight" size="16" />
                </button>
                <button v-if="currentStep === steps.length - 1" class="run-button" @click="runSimulation"
                    :disabled="isRunning">
                    <Icon name="Play" size="16" />
                    {{ isRunning ? 'Running...' : 'Run Simulation' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import IconButton from '../shared/IconButton.vue';
import CustomSelect from '../shared/CustomSelect.vue';
import Icon from '../shared/Icon.vue';
import { apiUrl, fetchEda } from '../../api';

interface InputSource {
    id: string;
    type: 'dc' | 'sin';
    dcVoltage: number | null;
    sinAmplitude: number | null;
    sinOffset: number | null;
    sinFrequency: number | null;
}

interface OutputSignal {
    id: string;
    name: string;
}

interface SimulationResults {
    inputSourcesCount: number;
    outputSignalsCount: number;
    status: string;
    timestamp: string;
}

const isSettingsOpen = ref(false);
const currentStep = ref(0);
const isRunning = ref(false);
const simulationResults = ref<SimulationResults | null>(null);

const inputSources = ref<InputSource[]>([]);
const outputSignals = ref<OutputSignal[]>([]);

const steps = [
    { id: 'sources', label: 'Input Sources' },
    { id: 'outputs', label: 'Output Signals' },
    { id: 'results', label: 'Results' }
];

const openSettings = () => {
    isSettingsOpen.value = true;
    currentStep.value = 0;
    simulationResults.value = null;
};

const closeSettings = () => {
    isSettingsOpen.value = false;
};

const generateId = (): string => {
    return `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const addInputSource = () => {
    inputSources.value.push({
        id: generateId(),
        type: 'dc',
        dcVoltage: null,
        sinAmplitude: null,
        sinOffset: null,
        sinFrequency: null
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

const goToStep = (stepIndex: number) => {
    currentStep.value = stepIndex;
};

const prevStep = () => {
    if (currentStep.value > 0) {
        currentStep.value--;
    }
};

const nextStep = () => {
    if (currentStep.value < steps.length - 1) {
        currentStep.value++;
        if (currentStep.value === steps.length - 1) {
            runSimulation();
        }
    }
};

const runSimulation = async () => {
    isRunning.value = true;
    currentStep.value = 2;

    // Имитация запуска симуляции
    await new Promise(resolve => setTimeout(resolve, 2000));

    const responce = await fetchEda(apiUrl + '/v1/simulate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },

        body: JSON.stringify(
            {
                "step_time_ns": 10,
                "end_time_ns": 1000,
                "output_signals": [
                    "VREF5",
                    "VREF3",
                    "OUT3",
                    "OUT5",
                    "VIN"
                ],
                "input_signals": [
                    {
                        "name": "INPUT",
                        "signal_name": "VCC12",
                        "value": "12",
                        "frequency": "1000",
                        "offset": "0",
                        "type": "DC"
                    },
                    {
                        "name": "INPUT_1",
                        "signal_name": "VIN",
                        "value": "4",
                        "frequency": "10",
                        "offset": "4",
                        "type": "SIN"
                    }
                ],
                "components": [
                    {
                        "designator": "U1_2",
                        "value": "LM393",
                        "pins": [
                            {
                                "pin_number": 3,
                                "name": "1IN+",
                                "signal_name": "VIN"
                            },
                            {
                                "pin_number": 2,
                                "name": "1IN-",
                                "signal_name": "VREF5"
                            },
                            {
                                "pin_number": 1,
                                "name": "1OUT1",
                                "signal_name": "OUT5"
                            },
                            {
                                "pin_number": 8,
                                "name": "VCC",
                                "signal_name": "VCC12"
                            },
                            {
                                "pin_number": 4,
                                "name": "VEE",
                                "signal_name": "GND"
                            }
                        ],
                        "part_uuid": "50a68d56924049f8ba698a03698c50ca",
                        "pos": {
                            "x": 695,
                            "y": 340
                        }
                    },
                    {
                        "designator": "R5",
                        "value": "3.3kΩ",
                        "pins": [
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "LED1_A"
                            },
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "VCC12"
                            }
                        ],
                        "part_uuid": "ce00b8dfc43d4c069f96d4dd1592c5c5",
                        "pos": {
                            "x": 760,
                            "y": 560
                        }
                    },
                    {
                        "designator": "D2",
                        "value": "19-213/R6C-AQ1R2B/3T",
                        "pins": [
                            {
                                "pin_number": 1,
                                "name": "C",
                                "signal_name": "OUT5"
                            },
                            {
                                "pin_number": 2,
                                "name": "A",
                                "signal_name": "LED2_A"
                            }
                        ],
                        "part_uuid": "51f3a4f0c4f44616b1d82950d6e08e0c",
                        "pos": {
                            "x": 815,
                            "y": 440
                        }
                    },
                    {
                        "designator": "U1_1",
                        "value": "LM393",
                        "pins": [
                            {
                                "pin_number": 3,
                                "name": "1IN+",
                                "signal_name": "VIN"
                            },
                            {
                                "pin_number": 2,
                                "name": "1IN-",
                                "signal_name": "VREF3"
                            },
                            {
                                "pin_number": 1,
                                "name": "1OUT1",
                                "signal_name": "OUT3"
                            },
                            {
                                "pin_number": 8,
                                "name": "VCC",
                                "signal_name": "VCC12"
                            },
                            {
                                "pin_number": 4,
                                "name": "VEE",
                                "signal_name": "GND"
                            }
                        ],
                        "part_uuid": "50a68d56924049f8ba698a03698c50ca",
                        "pos": {
                            "x": 910,
                            "y": 540
                        }
                    },
                    {
                        "designator": "R6",
                        "value": "3.3kΩ",
                        "pins": [
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "LED2_A"
                            },
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "VCC12"
                            }
                        ],
                        "part_uuid": "ce00b8dfc43d4c069f96d4dd1592c5c5",
                        "pos": {
                            "x": 815,
                            "y": 540
                        }
                    },
                    {
                        "designator": "R8",
                        "value": "1.2kΩ",
                        "pins": [
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "VREF5"
                            },
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "VCC12"
                            }
                        ],
                        "part_uuid": "b794c3d2197a4f65babd147c5568394c",
                        "pos": {
                            "x": 225,
                            "y": 315
                        }
                    },
                    {
                        "designator": "D3",
                        "value": "BZX84C3V0",
                        "pins": [
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "NC"
                            },
                            {
                                "pin_number": 1,
                                "name": "C",
                                "signal_name": "VREF3"
                            },
                            {
                                "pin_number": 3,
                                "name": "A",
                                "signal_name": "GND"
                            }
                        ],
                        "part_uuid": "9701e4dbe1f14649b924d1b2b724bb44",
                        "pos": {
                            "x": 115,
                            "y": 305
                        }
                    },
                    {
                        "designator": "R7",
                        "value": "1.6kΩ",
                        "pins": [
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "VREF3"
                            },
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "VCC12"
                            }
                        ],
                        "part_uuid": "fcb471e208b6404d982bf57c77cdf697",
                        "pos": {
                            "x": 185,
                            "y": 350
                        }
                    },
                    {
                        "designator": "D4",
                        "value": "BZX84C5V1",
                        "pins": [
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "GND"
                            },
                            {
                                "pin_number": 3,
                                "name": "3",
                                "signal_name": "VREF5"
                            },
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "NC"
                            }
                        ],
                        "part_uuid": "df26ada4c66f4eaa9d96990907a894b5",
                        "pos": {
                            "x": 325,
                            "y": 305
                        }
                    },
                    {
                        "designator": "J2",
                        "value": "ZX-PM2.54-1-2PY",
                        "pins": [
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "VIN"
                            },
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "GND"
                            }
                        ],
                        "part_uuid": "40a2372189434e9b8b481771e37e7b2f",
                        "pos": {
                            "x": 285,
                            "y": 580
                        }
                    },
                    {
                        "designator": "D1",
                        "value": "19-213/R6C-AQ1R2B/3T",
                        "pins": [
                            {
                                "pin_number": 1,
                                "name": "C",
                                "signal_name": "OUT3"
                            },
                            {
                                "pin_number": 2,
                                "name": "A",
                                "signal_name": "LED1_A"
                            }
                        ],
                        "part_uuid": "51f3a4f0c4f44616b1d82950d6e08e0c",
                        "pos": {
                            "x": 760,
                            "y": 660
                        }
                    },
                    {
                        "designator": "J1",
                        "value": "WJ500V-5.08-2P",
                        "pins": [
                            {
                                "pin_number": 1,
                                "name": "1",
                                "signal_name": "VCC12"
                            },
                            {
                                "pin_number": 2,
                                "name": "2",
                                "signal_name": "GND"
                            }
                        ],
                        "part_uuid": "c7c1fca050bb4bd1b0bf3cd7b619ff3b",
                        "pos": {
                            "x": 285,
                            "y": 670
                        }
                    }
                ]
            }
        )
    });

    const json = await responce.json() as {
        time: number[],
        output_signals: {
            signal_name: string,
            volages: number[]
        }[]
    }

    console.log(json)

    simulationResults.value = {
        inputSourcesCount: inputSources.value.length,
        outputSignalsCount: outputSignals.value.length,
        status: 'Completed',
        timestamp: new Date().toISOString()
    };

    isRunning.value = false;
};

const exportResults = () => {
    console.log('Exporting results...');
};
</script>

<style scoped>
@import url("../settings/shared.css");

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

.simulate {
    padding: 0.3rem 0.7rem 0.3rem 0.3rem;
    background-color: var(--color-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-on-primary);
}

/* Полноэкранная страница настроек */
.settings-full-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--color-surface);
}

/* Stepper */
.stepper-container {
    display: flex;
    justify-content: center;
    padding: 1.5rem 1rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background);
}

.step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    padding: 0 1.5rem;
    position: relative;
    width: 64px;
}

.step-item:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 19%;
    left: 50%;
    width: 100%;
    height: 2px;
    background: var(--color-border);
    z-index: 0;
}

.step-item.step-completed:not(:last-child)::after {
    background: var(--color-primary);
}

.step-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 12px;
    z-index: 1;
    transition: all 0.2s;
}

.step-item.step-active .step-circle {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-text-on-primary);
}

.step-item.step-completed .step-circle {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-text-on-primary);
}

.step-number-disabled {
    color: var(--color-text-muted);
}

.step-label {
    margin-top: 0.5rem;
    font-size: 0.65rem;
    color: var(--color-text);
    font-weight: 500;
    text-align: center;
}

.step-item.step-active .step-label {
    color: var(--color-primary);
}

.step-item.step-completed .step-label {
    color: var(--color-text);
}

/* Контент */
.settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 2rem;
}

.settings-content {
    max-width: 800px;
    margin: 0 auto;
}

.step-content {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Секции */
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

.add-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.2rem 0.8rem 0.2rem 0.5rem;
    background: var(--color-primary);
    border: none;
    border-radius: 4px;
    color: var(--color-text-on-primary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
}

.add-button:hover {
    opacity: 0.9;
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

/* Элементы списка */
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

.remove-button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
}

.remove-button:hover {
    background: var(--color-surface-hover);
    color: var(--color-error, #ef4444);
}

/* Формы */
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

.form-group input[type="text"],
.form-group input[type="number"] {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--color-surface);
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

/* Footer с навигацией */
.settings-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-background);
}

.footer-spacer {
    flex: 1;
}

.back-button,
.next-button,
.run-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
}

.back-button {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    padding: 0.2rem 0.8rem 0.2rem 0.3rem;
}

.back-button:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-border-light);
}

.next-button {
    background: var(--color-primary);
    border: none;
    color: var(--color-text-on-primary);
    padding: 0.2rem 0.3rem 0.2rem 0.8rem;
}

.next-button:hover {
    opacity: 0.9;
}

.run-button {
    background: var(--color-primary);
    border: none;
    color: var(--color-text-on-primary);
    padding: 0.2rem 0.8rem 0.2rem 0.3rem;
}

.run-button:hover {
    opacity: 0.9;
}

.run-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Результаты симуляции */
.results-step {
    padding-bottom: 1rem;
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

.refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
}

.refresh-button:hover:not(:disabled) {
    background: var(--color-surface-hover);
}

.refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.refresh-button .spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-text-tertiary);
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

.no-results {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-tertiary);
}

.results-content {
    animation: fadeIn 0.3s ease;
}

.result-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.summary-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.summary-label {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    margin-bottom: 0.5rem;
}

.summary-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text);
}

.summary-value.status-success {
    color: var(--color-success, #10a37f);
}

.results-details {
    margin-bottom: 1.5rem;
}

.results-details h4 {
    margin: 1.5rem 0 1rem 0;
    font-size: 0.95rem;
    color: var(--color-text);
    font-weight: 600;
}

.results-details h4:first-child {
    margin-top: 0;
}

.result-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 0.75rem;
}

.result-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.result-item-label {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.9rem;
}

.result-item-type {
    background: var(--color-primary);
    color: var(--color-text-on-primary);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
}

.result-item-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
}

.detail-label {
    color: var(--color-text-tertiary);
    font-weight: 500;
}

.detail-value {
    color: var(--color-text);
    margin-right: 0.5rem;
}

.detail-value.code {
    font-family: 'Courier New', monospace;
    background: var(--color-background);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
}

.results-actions {
    display: flex;
    justify-content: center;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}

.export-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
}

.export-button:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-primary);
}
</style>

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
                                            { label: 'Transient (TRAN)', value: 'tran' },
                                            { label: 'AC Analysis', value: 'ac' },
                                            { label: 'DC Sweep', value: 'dc' },
                                            { label: 'Operating Point (OP)', value: 'op' }
                                        ]" @update:model-value="simulationType = $event" />
                                    </div>

                                    <!-- Transient Settings -->
                                    <div v-if="simulationType === 'tran'" class="form-row">
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

                                    <!-- AC Analysis Settings -->
                                    <div v-if="simulationType === 'ac'" class="form-row">
                                        <div class="form-group">
                                            <label for="start-freq">Start Frequency (Hz)</label>
                                            <UnitInput id="start-freq" variant="freq" v-model="acStartFreq"
                                                placeholder="10" />
                                        </div>

                                        <div class="form-group">
                                            <label for="end-freq">End Frequency (Hz)</label>
                                            <UnitInput id="end-freq" variant="freq" v-model="acEndFreq"
                                                placeholder="1e6" />
                                        </div>
                                    </div>
                                    <div v-if="simulationType === 'ac'" class="form-group">
                                        <label for="points-per-decade">Points per Decade</label>
                                        <input type="number" id="points-per-decade" v-model="acPointsPerDecade" step="1"
                                            placeholder="100" />
                                    </div>
                                    <div v-if="simulationType === 'ac'" class="form-group">
                                        <label for="sweep-type">Sweep Type</label>
                                        <CustomSelect :model-value="acSweepType" :options="[
                                            { label: 'Decade (dec)', value: 'dec' },
                                            { label: 'Octave (oct)', value: 'oct' },
                                            { label: 'Linear (lin)', value: 'lin' }
                                        ]" @update:model-value="acSweepType = $event" />
                                    </div>

                                    <!-- DC Sweep Settings -->
                                    <div v-if="simulationType === 'dc'" class="form-group">
                                        <NetInput id="dc-source-name" v-model="dcNetName"></NetInput>
                                    </div>
                                    <div v-if="simulationType === 'dc'" class="form-row">
                                        <div class="form-group">
                                            <label for="dc-start">Start Value (V)</label>
                                            <UnitInput id="dc-start" variant="voltage" v-model="dcStartValue"
                                                placeholder="0" />
                                        </div>

                                        <div class="form-group">
                                            <label for="dc-end">End Value (V)</label>
                                            <UnitInput id="dc-end" variant="voltage" v-model="dcEndValue"
                                                placeholder="5" />
                                        </div>
                                    </div>
                                    <div v-if="simulationType === 'dc'" class="form-group">
                                        <label for="dc-step">Step Value (V)</label>
                                        <UnitInput id="dc-step" variant="voltage" v-model="dcStepValue"
                                            placeholder="0.1" />
                                    </div>

                                    <!-- OP Analysis has no additional settings -->
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="section-header">
                                    <h3>Error Tolerances</h3>
                                </div>

                                <p class="section-description">
                                    Control the accuracy of the simulation. Lower values increase accuracy but slow down
                                    computation.
                                </p>

                                <div class="settings-form">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="abstol">ABSTOL (A)</label>
                                            <UnitInput id="abstol" variant="current" v-model="abstol"
                                                placeholder="1p" />
                                            <span class="field-description">Absolute current tolerance in Amperes</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="reltol">RELTOL</label>
                                            <input type="number" id="reltol" v-model="reltol" step="0.001"
                                                placeholder="0.001" />
                                            <span class="field-description">Relative tolerance for voltages and currents
                                                (0.001 = 0.1%)</span>
                                        </div>
                                    </div>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="vntol">VNTOL (V)</label>
                                            <UnitInput id="vntol" variant="voltage" v-model="vntol" placeholder="1u" />
                                            <span class="field-description">Absolute voltage tolerance in Volts</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="chgtol">CHGTOL (C)</label>
                                            <UnitInput id="chgtol" variant="charge" v-model="chgtol"
                                                placeholder="10f" />
                                            <span class="field-description">Absolute charge tolerance in Coulombs</span>
                                        </div>
                                    </div>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="trtol">TRTOL</label>
                                            <input type="number" id="trtol" v-model="trtol" step="0.1"
                                                placeholder="7.0" />
                                            <span class="field-description">Time step error coefficient. Lower = more
                                                accurate .tran steps</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="pivrel">PIVREL</label>
                                            <input type="number" id="pivrel" v-model="pivrel" step="1e-3"
                                                placeholder="1e-3" />
                                            <span class="field-description">Relative pivot threshold for matrix
                                                selection</span>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label for="pivtol">PIVTOL</label>
                                        <input type="number" id="pivtol" v-model="pivtol" step="1e-13"
                                            placeholder="1e-13" />
                                        <span class="field-description">Absolute pivot threshold for matrix
                                            selection</span>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="section-header">
                                    <h3>Iteration Limits</h3>
                                </div>

                                <p class="section-description">
                                    Define when the simulator should stop iterating or adjust the calculation step.
                                </p>

                                <div class="settings-form">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="itl1">ITL1 (DC Op Point)</label>
                                            <input type="number" id="itl1" v-model="itl1" step="1" placeholder="100" />
                                            <span class="field-description">Iteration limit for DC operating point
                                                analysis</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="itl2">ITL2 (DC Sweep)</label>
                                            <input type="number" id="itl2" v-model="itl2" step="1" placeholder="50" />
                                            <span class="field-description">Iteration limit for each DC sweep point (.DC
                                                analysis)</span>
                                        </div>
                                    </div>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="itl4">ITL4 (TRAN Point)</label>
                                            <input type="number" id="itl4" v-model="itl4" step="1" placeholder="10" />
                                            <span class="field-description">Iteration limit per transient point.
                                                Exceeding reduces timestep</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="itl5">ITL5 (Total TRAN)</label>
                                            <input type="number" id="itl5" v-model="itl5" step="1" placeholder="5000" />
                                            <span class="field-description">Total iteration limit for entire transient
                                                analysis (0 = infinite)</span>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label for="itl6">ITL6 (Source Stepping)</label>
                                        <input type="number" id="itl6" v-model="itl6" step="1" placeholder="0" />
                                        <span class="field-description">Iteration limit for Source Stepping convergence
                                            algorithm</span>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="section-header">
                                    <h3>Analysis Methods</h3>
                                </div>

                                <p class="section-description">
                                    Configure numerical integration methods and convergence aids.
                                </p>

                                <div class="settings-form">
                                    <div class="form-group">
                                        <label for="method">METHOD</label>
                                        <CustomSelect :model-value="method" :options="[
                                            { label: 'Trapezoidal (trap)', value: 'trap' },
                                            { label: 'Gear', value: 'gear' }
                                        ]" @update:model-value="method = $event" />
                                        <span class="field-description">Integration method: trap (faster) or gear (more
                                            stable for stiff systems)</span>
                                    </div>

                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="gmin">GMIN</label>
                                            <input type="number" id="gmin" v-model="gmin" step="1e-12"
                                                placeholder="1e-12" />
                                            <span class="field-description">Minimum conductance added to each branch for
                                                convergence</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="gminsteps">GMINSTEPS</label>
                                            <input type="number" id="gminsteps" v-model="gminsteps" step="1"
                                                placeholder="0" />
                                            <span class="field-description">Number of Gmin-stepping algorithm
                                                steps</span>
                                        </div>

                                    </div>


                                    <div class="form-group">
                                        <label for="sourcesteps">SOURCESTEPS</label>
                                        <input type="number" id="sourcesteps" v-model="sourcesteps" step="1"
                                            placeholder="0" />
                                        <span class="field-description">Number of Source-stepping algorithm
                                            steps</span>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="section-header">
                                    <h3>Temperature</h3>
                                </div>

                                <p class="section-description">
                                    Set the operating and nominal temperatures for the simulation.
                                </p>

                                <div class="settings-form">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="temp">TEMP (°C)</label>
                                            <input type="number" id="temp" v-model="temp" step="1" placeholder="27" />
                                            <span class="field-description">Operating temperature of the circuit in
                                                Celsius</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="tnom">TNOM (°C)</label>
                                            <input type="number" id="tnom" v-model="tnom" step="1" placeholder="27" />
                                            <span class="field-description">Nominal temperature for model parameters
                                                measurement</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-section">
                                <div class="section-header">
                                    <h3>Stability (Shunts)</h3>
                                </div>

                                <p class="section-description">
                                    Add shunt elements to improve simulation stability and convergence.
                                </p>

                                <div class="settings-form">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="rshunt">RSHUNT (Ω)</label>
                                            <UnitInput id="rshunt" variant="resistance" v-model="rshunt"
                                                placeholder="∞" />
                                            <span class="field-description">Resistance from each node to ground (helps
                                                with floating nodes)</span>
                                        </div>

                                        <div class="form-group">
                                            <label for="cshunt">CSHUNT (F)</label>
                                            <UnitInput id="cshunt" variant="capacitance" v-model="cshunt"
                                                placeholder="0" />
                                            <span class="field-description">Capacitance from each node to ground (helps
                                                with sharp edges)</span>
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
                                <IconButton :size="18" icon="ExternalLink" variant="ghost" @click="openGraphInNewWindow"
                                    title="Open in new window" />
                            </div>

                            <TypingDots v-if="isRunning" status="Running simulation..." />

                            <div v-else-if="simulationResult" class="results-content">
                                <div style="height: 400px;">
                                    <SimGraph :simulation-result="simulationResult"></SimGraph>
                                </div>

                                <div v-if="simulationResult.warns.length > 0" class="warnings-section">
                                    <ErrorBanner v-for="(warn, index) in simulationResult.warns" :key="index"
                                        :message="warn.text" type="warn" />
                                </div>

                                <div v-if="simulationResult.component_map.length > 0" class="component-map-section">
                                    <h4>Component Mapping</h4>
                                    <div class="component-map-table">
                                        <div class="component-map-header">
                                            <span>Schematic Component</span>
                                            <span>SPICE Model</span>
                                        </div>
                                        <div v-for="(item, index) in simulationResult.component_map" :key="index"
                                            class="component-map-row">
                                            <span>{{ item.name }}</span>
                                            <span>{{ item.spice_model_name }}</span>
                                        </div>
                                    </div>
                                </div>
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
import { ref, watchEffect } from 'vue';
import IconButton from '../shared/IconButton.vue';
import CustomSelect from '../shared/CustomSelect.vue';
import ErrorBanner from '../shared/ErrorBanner.vue';
import Stepper from '../shared/Stepper.vue';
import { fetchWithTask } from '../../api';
import { getSchematic } from '../../eda/schematic';
import StepPanel from '../shared/StepPanel.vue';
import StepPanels from '../shared/StepPanels.vue';
import TypingDots from '../shared/TypingDots.vue';
import NetInput from '../shared/NetInput.vue';
import UnitInput, { UnitValue } from '../shared/UnitInput.vue';
import { isEasyEda, showToastMessage } from '../../eda/utils';
import { SimulateResult, SimulateResultSchema } from "@copilot/shared/types/spice";
import SimGraph from './SimGraph.vue';

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

declare global {
    interface EDA {
        simulationResult?: SimulateResult
    }
}

const isSettingsOpen = ref(false);
const isRunning = ref(false);
const simulationResult = ref<SimulateResult | null>(null);
const errorMessage = ref<string | null>(null);
const errorType = ref<'error' | 'warn'>('error');
const inputSources = ref<InputSource[]>([]);
const outputSignals = ref<OutputSignal[]>([]);
const abortController = ref<AbortController | undefined>();

const simulationType = ref<'tran' | 'ac' | 'dc' | 'op'>('tran');
const stepTime = ref<UnitValue>({ unit: 'u', value: 100 });
const endTime = ref<UnitValue>({ unit: 'm', value: 10 });

// AC Analysis Settings
const acStartFreq = ref<UnitValue>({ unit: 'base', value: 10 });
const acEndFreq = ref<UnitValue>({ unit: 'base', value: 1e6 });
const acPointsPerDecade = ref<number>(100);
const acSweepType = ref<'dec' | 'oct' | 'lin'>('dec');

// DC Sweep Settings
const dcNetName = ref<string | undefined>(undefined);
const dcStartValue = ref<UnitValue>({ unit: 'base', value: 0 });
const dcEndValue = ref<UnitValue>({ unit: 'base', value: 5 });
const dcStepValue = ref<UnitValue>({ unit: 'base', value: 0.1 });

// Error Tolerances
const abstol = ref<UnitValue>({ unit: 'n', value: 1 });
const reltol = ref<number>(0.01);
const vntol = ref<UnitValue>({ unit: 'u', value: 1 });
const chgtol = ref<UnitValue>({ unit: 'p', value: 1 });
const trtol = ref<number>(7.0);
const pivrel = ref<number>(1e-3);
const pivtol = ref<number>(1e-13);

// Iteration Limits
const itl1 = ref<number>(500);
const itl2 = ref<number>(200);
const itl4 = ref<number>(100);
const itl5 = ref<number>(5000);
const itl6 = ref<number>(0);

// Analysis Methods
const method = ref<'trap' | 'gear'>('gear');
const gmin = ref<number>(1e-12);
const gminsteps = ref<number>(0);
const sourcesteps = ref<number>(0);

// Temperature
const temp = ref<number>(25);
const tnom = ref<number>(25);

// Stability (Shunts)
const rshunt = ref<UnitValue>({ unit: 'G', value: 10 });
const cshunt = ref<UnitValue>({ unit: 'p', value: 1 });

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

        const input_signals = inputSources.value.map((source, index) => ({
            name: `INPUT_${index}`,
            signal_name: source.signalName,
            value: source.amplitude?.valueInUnits?.base ?? 1,
            frequency: source.frequency?.valueInUnits?.base ?? 1000,
            offset: source.offset?.valueInUnits?.base ?? 0,
            type: source.type.toUpperCase(),
            fill: source.fill ?? 50
        }))
        // Формируем body в зависимости от типа анализа
        const baseBody = {
            output_signals: outputSignals.value.map(s => s.name),
            input_signals,
            components: isEasyEda() ? (await getSchematic()).components : [],

            // components: [
            //     {
            //         "designator": "R4",
            //         "value": "56kΩ",
            //         "pins": [
            //             {
            //                 "pin_number": "2",
            //                 "name": "2",
            //                 "signal_name": "VIN"
            //             },
            //             {
            //                 "pin_number": "1",
            //                 "name": "1",
            //                 "signal_name": "NET1"
            //             }
            //         ],
            //         "part_uuid": "856fddc18019495081b89d9458a1110c",
            //         "pos": {
            //             "x": 195,
            //             "y": 880
            //         }
            //     },
            //     {
            //         "designator": "R5",
            //         "value": "56kΩ",
            //         "pins": [
            //             {
            //                 "pin_number": "2",
            //                 "name": "2",
            //                 "signal_name": "NET1"
            //             },
            //             {
            //                 "pin_number": "1",
            //                 "name": "1",
            //                 "signal_name": "GND"
            //             }
            //         ],
            //         "part_uuid": "856fddc18019495081b89d9458a1110c",
            //         "pos": {
            //             "x": 195,
            //             "y": 815
            //         }
            //     }
            // ],

            options: {// Error Tolerances
                abstol: abstol.value?.valueInUnits?.base ?? 1e-12,
                reltol: reltol.value,
                vntol: vntol.value?.valueInUnits?.base ?? 1e-6,
                chgtol: chgtol.value?.valueInUnits?.base ?? 1e-14,
                trtol: trtol.value,
                pivrel: pivrel.value,
                pivtol: pivtol.value,

                // Iteration Limits
                itl1: itl1.value,
                itl2: itl2.value,
                itl4: itl4.value,
                itl5: itl5.value,
                itl6: itl6.value,

                // Analysis Methods
                method: method.value,
                gmin: gmin.value,
                gminsteps: gminsteps.value,
                sourcesteps: sourcesteps.value,

                // Temperature
                temp: temp.value,
                tnom: tnom.value,

                // Stability (Shunts)
                rshunt: rshunt.value?.valueInUnits?.base,
                cshunt: cshunt.value?.valueInUnits?.base
            }
        };

        let body: any = { ...baseBody };

        // Добавляем параметры в зависимости от типа анализа
        if (simulationType.value === 'tran') {
            body = {
                ...body,
                analysis_options: {
                    type: 'transient' as const,
                    step_time_ns: stepTime.value?.valueInUnits?.n ?? 100,
                    end_time_ns: endTime.value?.valueInUnits?.n ?? 60000,
                },
                // Обратная совместимость
                step_time_ns: stepTime.value?.valueInUnits?.n ?? 100,
                end_time_ns: endTime.value?.valueInUnits?.n ?? 60000,
            };
        } else if (simulationType.value === 'ac') {
            body = {
                ...body,
                analysis_options: {
                    type: 'ac' as const,
                    start_freq: acStartFreq.value?.valueInUnits?.base ?? 10,
                    end_freq: acEndFreq.value?.valueInUnits?.base ?? 1e6,
                    points_per_decade: acPointsPerDecade.value,
                    sweep_type: acSweepType.value,
                },
            };
        } else if (simulationType.value === 'dc') {
            const source = input_signals.find(is => is.signal_name === dcNetName.value)

            if (!source || !dcNetName.value)
                throw new Error('Source net unknown');

            body = {
                ...body,
                analysis_options: {
                    type: 'dc' as const,
                    source_name: source.name,
                    start_value: dcStartValue.value?.valueInUnits?.base ?? 0,
                    end_value: dcEndValue.value?.valueInUnits?.base ?? 5,
                    step_value: dcStepValue.value?.valueInUnits?.base ?? 0.1,
                },
            };
        } else if (simulationType.value === 'op') {
            body = {
                ...body,
                analysis_options: {
                    type: 'op' as const,
                },
            };
        }

        const response = await fetchWithTask({
            url: '/v1/simulate',
            fetchOptions: { signal: controller.signal },
            body: body,
            pollIntervalMs: 1000
        });

        const json = SimulateResultSchema().parse(response)

        simulationResult.value = json;
        // Сохраняем данные в eda для открытия в новом окне

        if (isEasyEda())
            eda.simulationResult = simulationResult.value;

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

function formatSI(value: number, unit: string): string {
    if (value === 0) return '0 ' + unit;
    const prefixes = ['y', 'z', 'a', 'f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    const absValue = Math.abs(value);
    const exp = Math.floor(Math.log10(absValue));
    let idx = Math.floor(exp / 3) + 8;
    idx = Math.max(0, Math.min(prefixes.length - 1, idx));
    const scaled = value / Math.pow(10, (idx - 8) * 3);
    const formatted = scaled.toFixed(2).replace(/\.?0+$/, '');
    return formatted + ' ' + prefixes[idx] + unit;
}

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
    margin: 0 auto;
    padding: 1rem;
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

.section-description {
    margin-bottom: 1rem;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    line-height: 1.5;
}

.field-description {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    line-height: 1.4;
}

.empty-list {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.9rem;
}

.source-item,
.output-item {
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

.settings-form {}

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

.warnings-section {
    margin-top: 1.5rem;
    background: var(--color-background);
}

.warnings-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: var(--color-text);
    font-weight: 600;
}

.warning-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.85rem;
}

.warning-item:last-child {
    border-bottom: none;
}

.warning-type {
    font-weight: 600;
    color: var(--color-warning);
    min-width: 80px;
}

.warning-text {
    color: var(--color-text-secondary);
    flex: 1;
}

.component-map-section {
    margin-top: 1.5rem;
    padding: 1rem;
}

.component-map-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: var(--color-text);
    font-weight: 600;
}

.component-map-table {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.component-map-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 0.5rem;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--color-text);
    border-bottom: 2px solid var(--color-border);
}

.component-map-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 0.5rem;
    font-size: 0.85rem;
    border-bottom: 1px solid var(--color-border);
}

.component-map-row:last-child {
    border-bottom: none;
}

.component-map-row span:first-child {
    font-weight: 500;
    color: var(--color-text);
}

.component-map-row span:last-child {
    color: var(--color-text-secondary);
}
</style>

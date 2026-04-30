<template>
    <div class="recalc-editor">
        <header class="editor-header">
            <h1>Reused Blocks Editor</h1>
            <div class="header-actions">
                <IconButton icon="FileDown" @click="loadFromFile" title="Load from file" />
                <IconButton icon="Save" @click="saveToFile" title="Save to file" />
                <IconButton icon="Sparkles" @click="autoFill" title="Auto fill with AI" :disabled="isAutoFilling" />
            </div>
        </header>

        <!-- TABS -->
        <div class="tabs">
            <button :class="['tab', { active: activeTab === 'ports' }]" @click="activeTab = 'ports'">Ports</button>
            <button :class="['tab', { active: activeTab === 'parameters' }]"
                @click="activeTab = 'parameters'">Parameters</button>
            <button :class="['tab', { active: activeTab === 'constraints' }]"
                @click="activeTab = 'constraints'">Constraints</button>
            <button :class="['tab', { active: activeTab === 'components' }]"
                @click="activeTab = 'components'">Components</button>
        </div>

        <!-- PORTS TAB -->
        <section v-if="activeTab === 'ports'" class="tab-content">
            <h2>Ports</h2>
            <p class="section-description">Define circuit ports. Ports are bound to nets (signal_name) via the
                {PORT_XXX} template.</p>

            <div v-for="(port, idx) in data.recalculation_meta.ports" :key="idx" class="card">
                <Collapsible :default-open="true">
                    <template #title>
                        <div class="card-title-row">
                            <span class="card-title">Port #{{ idx + 1 }}</span>
                            <IconButton icon="Trash2" variant="remove" @click="removePort(idx)" title="Remove port"
                                :size="14" />
                        </div>
                    </template>
                    <div class="field-row">
                        <div class="setting-group">
                            <label for="port-name-{{ idx }}">Port Name</label>
                            <input :id="'port-name-' + idx" type="text" v-model="port.port_number"
                                placeholder="e.g. VIN" />
                        </div>
                        <div class="setting-group">
                            <label for="port-desc-{{ idx }}">Description</label>
                            <input :id="'port-desc-' + idx" type="text" v-model="port.description"
                                placeholder="e.g. INPUT VOLTAGE" />
                        </div>
                        <div class="setting-group">
                            <label for="port-param-{{ idx }}">Related Parameter</label>
                            <input :id="'port-param-' + idx" type="text" v-model="port.related_parameter"
                                placeholder="e.g. vin (optional)" />
                        </div>
                    </div>
                </Collapsible>
            </div>

            <IconButton icon="Plus" variant="primary" :size="14" @click="addPort">Add Port </IconButton>
        </section>

        <!-- PARAMETERS TAB -->
        <section v-if="activeTab === 'parameters'" class="tab-content">
            <h2>Parameters</h2>
            <p class="section-description">Global circuit parameters with value ranges. Parameters with allow_recalc
                enabled are available for recalculation.</p>

            <div v-for="(param, key) in data.recalculation_meta.parameters" :key="key" class="card">
                <Collapsible :default-open="true">
                    <template #title>
                        <div class="card-title-row">
                            <span class="card-title">{{ key }}</span>
                            <IconButton icon="Trash2" variant="remove" @click="removeParameter(key as string)"
                                title="Remove parameter" :size="14" />
                        </div>
                    </template>
                    <div class="field-row">
                        <div class="setting-group">
                            <label :for="`param-min-${key}`">Min</label>
                            <input :id="'param-min-' + key" type="number" v-model.number="param.min" placeholder="—" />
                        </div>
                        <div class="setting-group">
                            <label :for="`param-nom-${key}`">Nominal</label>
                            <input :id="'param-nom-' + key" type="number" v-model.number="param.nominal"
                                placeholder="Required" />
                        </div>
                        <div class="setting-group">
                            <label :for="`param-max-${key}`">Max</label>
                            <input :id="'param-max-' + key" type="number" v-model.number="param.max" placeholder="—" />
                        </div>
                        <div class="setting-group checkbox-group" style="margin: auto;">
                            <label :for="`param-recalc-${key}`">
                                <input :id="'param-recalc-' + key" type="checkbox" v-model="param.allow_recalc" />
                                Allow recalc
                            </label>
                        </div>
                    </div>
                </Collapsible>
            </div>

            <div class="add-parameter-row">
                <div class="setting-group">
                    <label for="new-param-name">New Parameter Name</label>
                    <input id="new-param-name" type="text" v-model="newParamName" placeholder="e.g. Vout" />
                </div>
                <IconButton icon="Plus" variant="primary" :size="14" :disabled="!newParamName.trim()"
                    @click="addParameter">Add
                    Constraint
                </IconButton>
            </div>
        </section>

        <!-- CONSTRAINTS TAB -->
        <section v-if="activeTab === 'constraints'" class="tab-content">
            <h2>Constraints</h2>
            <p class="section-description">Constraints as string expressions (e.g. "Vout &lt; 8").</p>

            <div v-for="(constraint, idx) in data.recalculation_meta.constraints" :key="idx" class="constraint-row">
                <div class="setting-group flex-grow">
                    <label for="constraint-{{ idx }}">Constraint</label>
                    <input :id="'constraint-' + idx" type="text" v-model="data.recalculation_meta.constraints[idx]"
                        placeholder="Vout < 8" />
                </div>
                <IconButton icon="Trash2" variant="remove" @click="removeConstraint(idx)" title="Remove" :size="14" />
            </div>

            <IconButton icon="Plus" variant="primary" :size="14" @click="addConstraint">Add Constraint</IconButton>
        </section>

        <!-- COMPONENTS TAB -->
        <section v-if="activeTab === 'components'" class="tab-content">
            <h2>Components</h2>
            <p class="section-description">
                Edit nets (signal_name) and recalculation formulas for components.
                Use the <code>{PORT_XXX}</code> or <code>{PARAM_XXX}</code> or <code>{PARAM_XXX_min}</code> or
                <code>{PARAM_XXX_max}</code> template to bind a net to a port — all
                identical
                signal_names will be
                replaced simultaneously.
            </p>

            <!-- Global Signal Name Replacement -->
            <div class="card global-replace-card">
                <Collapsible title="Replace Signal Names (Global)" :default-open="true">
                    <div class="field-row">
                        <div class="setting-group flex-grow">
                            <label for="select-signal-name">Select Signal Name</label>
                            <CustomSelect id="select-signal-name" v-model="selectedSignalName"
                                :options="signalNameOptions" />
                        </div>
                        <div class="setting-group flex-grow">
                            <label for="new-signal-name">New Signal Name</label>
                            <input id="new-signal-name" v-model="newSignalName" type="text"
                                placeholder="Enter new signal name" />
                        </div>
                        <div class="button-group">
                            <IconButton icon="Replace" variant="primary" :size="14"
                                :disabled="!selectedSignalName || !newSignalName.trim()"
                                @click="replaceSignalName(selectedSignalName, newSignalName)"
                                title="Replace all occurrences" />
                        </div>
                    </div>
                </Collapsible>
            </div>

            <div v-for="(comp, cIdx) in filteredComponents" :key="cIdx" class="card">
                <Collapsible :default-open="false">
                    <template #title>
                        <div class="card-title-row">
                            <span class="card-title">{{ comp.designator }} — {{ comp.value }}</span>
                            <span v-if="comp.recalc" class="badge">recalc</span>
                        </div>
                    </template>

                    <!-- Pins -->
                    <div class="sub-section">
                        <h3>Nets (Pins)</h3>
                        <div v-for="(pin, pIdx) in comp.pins" :key="pIdx" class="pin-row">
                            <span class="pin-label">Pin {{ pin.pin_number }} ({{ pin.name }})</span>
                            <div class="signal-input-wrapper">
                                <input type="text" :value="pin.signal_name"
                                    @input="onSignalNameChange(pin.signal_name, ($event.target as HTMLInputElement).value)"
                                    placeholder="signal_name" />
                                <button v-if="isPortSignal(pin.signal_name)" class="btn-icon btn-port-link"
                                    @click="assignToPort(pin)" title="Link to port">
                                    <Icon name="Replace" :size="12" />
                                </button>
                            </div>
                            <span v-if="isPortSignal(pin.signal_name)" class="port-badge">
                                → {{ extractPortName(pin.signal_name) }}
                            </span>
                        </div>
                    </div>

                    <!-- Recalc -->
                    <div class="sub-section">
                        <h3>Recalculation</h3>
                        <div v-if="comp.recalc" class="recalc-fields">
                            <div class="setting-group">
                                <label for="recalc-formula-{{ cIdx }}">Formula</label>
                                <input :id="'recalc-formula-' + cIdx" type="text" v-model="comp.recalc.formula"
                                    placeholder="100000 * (Vout / 0.5 - 1)" />
                            </div>
                            <div class="field-row">
                                <div class="setting-group">
                                    <label for="recalc-unit-{{ cIdx }}">Unit</label>
                                    <input :id="'recalc-unit-' + cIdx" type="text" v-model="comp.recalc.unit"
                                        placeholder="Ohm" />
                                </div>
                                <div class="setting-group flex-grow">
                                    <label for="recalc-lcsc-{{ cIdx }}">LCSC Query Template</label>
                                    <input :id="'recalc-lcsc-' + cIdx" type="text"
                                        v-model="comp.recalc.lcsc_query_template"
                                        placeholder="resistor {value}Ohm smd 0603" />
                                </div>
                            </div>
                            <IconButton icon="Trash2" variant="remove" @click="comp.recalc = undefined"
                                title="Remove recalc" :size="14" />
                        </div>

                        <IconButton icon="Plus" variant="primary" :size="14" @click="addRecalc(comp)">Add Recalc
                        </IconButton>
                    </div>
                </Collapsible>
            </div>
        </section>

        <!-- JSON Preview -->
        <div class="json-preview">
            <Collapsible title="JSON Preview" :default-open="false">
                <pre class="json-content">{{ JSON.stringify(data, null, 2) }}</pre>
            </Collapsible>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watchEffect } from 'vue';
import Icon from './components/shared/Icon.vue';
import IconButton from './components/shared/IconButton.vue';
import Collapsible from './components/shared/Collapsible.vue';
import CustomSelect from './components/shared/CustomSelect.vue';
import { CircuitAssemblyStructWithRecalc, type CircuitAssemblyWithRecalc } from '@copilot/shared/types/recalc';
import { useSettingsStore } from './stores/settings-store';
import { setTheme } from './composables/useTheme';
import { ThemeName } from './theme/themes';
import { fetchEda, apiUrl } from './api/index';
import { makeLLmSettings } from './utils/llm-settings';

const settingsStore = useSettingsStore();

// Constants
const unknown_shortsym = 'unknown_shortsym';

// Инициализировать тему при загрузке приложения
onMounted(() => {
    settingsStore.loadSettings();
    setTheme((settingsStore.getSetting('theme') || 'light') as ThemeName);

    watchEffect(() => {
        const theme = settingsStore.getSetting('theme') || 'light';
        setTheme(theme as ThemeName);
    });
});

// ─── State ───────────────────────────────────────────────────────────
const activeTab = ref<'ports' | 'parameters' | 'constraints' | 'components'>('ports');
const newParamName = ref('');
const isAutoFilling = ref(false);

const data = reactive<CircuitAssemblyWithRecalc>({
    recalculation_meta: {
        parameters: {},
        constraints: [],
        ports: [],
    },
    components: [],
    blocks_rect: [],
    blocks: [],
    edges: [],
});

// Filtered components (skip unknown_shortsym and designators with |)
const filteredComponents = computed(() => {
    return data.components.filter(
        comp => comp.value !== unknown_shortsym && !comp.designator.includes('|')
    );
});

// Get all unique signal names as options for CustomSelect
const signalNameOptions = computed(() => {
    const names = new Set<string>();
    for (const comp of data.components) {
        for (const pin of comp.pins) {
            if (pin.signal_name) {
                names.add(pin.signal_name);
            }
        }
    }
    return Array.from(names).sort().map(name => ({ value: name, label: name }));
});

// State for global signal name replacement
const selectedSignalName = ref('');
const newSignalName = ref('');

// ─── Ports ───────────────────────────────────────────────────────────
function addPort() {
    data.recalculation_meta.ports.push({
        port_number: '',
        description: '',
        related_parameter: undefined,
    });
}

function removePort(idx: number) {
    data.recalculation_meta.ports.splice(idx, 1);
}

// ─── Parameters ──────────────────────────────────────────────────────
function addParameter() {
    const name = newParamName.value.trim();
    if (!name) return;
    data.recalculation_meta.parameters[name] = {
        min: 0,
        nominal: 0,
        max: 0,
        allow_recalc: false,
    };
    newParamName.value = '';
}

function removeParameter(key: string) {
    delete data.recalculation_meta.parameters[key];
}

// ─── Constraints ─────────────────────────────────────────────────────
function addConstraint() {
    data.recalculation_meta.constraints.push('');
}

function removeConstraint(idx: number) {
    data.recalculation_meta.constraints.splice(idx, 1);
}

// ─── Components ──────────────────────────────────────────────────────
function onSignalNameChange(oldSignal: string, newSignal: string) {
    for (const c of data.components) {
        for (const pin of c.pins) {
            if (pin.signal_name === oldSignal) {
                pin.signal_name = newSignal;
            }
        }
    }
}

function isPortSignal(signalName: string): boolean {
    return signalName.startsWith('{PORT_') && signalName.endsWith('}');
}

function extractPortName(signalName: string): string {
    return signalName.replace('{PORT_', '').replace('}', '');
}

function assignToPort(pin: CircuitAssemblyWithRecalc['components'][0]['pins'][0]) {
    const portName = extractPortName(pin.signal_name);
    const port = data.recalculation_meta.ports.find(p => p.port_number === portName);
    if (port) return;
    data.recalculation_meta.ports.push({
        port_number: portName,
        description: '',
        related_parameter: undefined,
    });
}

function addRecalc(comp: CircuitAssemblyWithRecalc['components'][0]) {
    comp.recalc = {
        formula: '',
        unit: '',
        lcsc_query_template: '',
    };
}

function replaceSignalName(oldSignal: string, newSignal: string) {
    if (!oldSignal || !newSignal.trim()) return;
    const trimmedNewSignal = newSignal.trim();

    for (const comp of data.components) {
        for (const pin of comp.pins) {
            if (pin.signal_name === oldSignal) {
                pin.signal_name = trimmedNewSignal;
            }
        }
    }

    // Reset the form
    selectedSignalName.value = '';
    newSignalName.value = '';
}

// ─── File I/O ────────────────────────────────────────────────────────
async function autoFill() {
    if (isAutoFilling.value) return;
    isAutoFilling.value = true;

    try {
        const llmSettings = makeLLmSettings(settingsStore);
        const payload = {
            llmSettings,
            circuit: {
                ...data,
                metadata: {
                    project_name: '',
                    description: ''
                }
            },
        };

        const res = await fetchEda(apiUrl + '/fill-reused-params', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to auto fill: ${res.status} ${errorText}`);
        }

        const result = await res.json();
        applyData(result.result);
        alert('Auto fill completed successfully');
    } catch (err) {
        alert('Error during auto fill: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
        isAutoFilling.value = false;
    }
}

// ─── File I/O ────────────────────────────────────────────────────────
function loadFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            const parsed = JSON.parse(content);
            applyData(parsed);
        } catch (err) {
            alert('Failed to load file: ' + (err instanceof Error ? err.message : 'Invalid format'));
        } finally {
            document.body.removeChild(input);
        }
    };

    document.body.appendChild(input);
    input.click();
}

function applyData(parsed: Partial<CircuitAssemblyWithRecalc>) {
    if (parsed.recalculation_meta) {
        const meta = parsed.recalculation_meta;
        data.recalculation_meta.parameters = meta.parameters ?? {};
        data.recalculation_meta.constraints = meta.constraints ?? [];
        data.recalculation_meta.ports = meta.ports ?? [];
    }
    if (Array.isArray(parsed.components)) {
        data.components = parsed.components;
    }
    if (parsed.blocks_rect) data.blocks_rect = parsed.blocks_rect;
    if (parsed.blocks) data.blocks = parsed.blocks;
    if (parsed.edges) data.edges = parsed.edges;
}

function saveToFile() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recalc.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
</script>

<style scoped>
@import url("./components/settings/shared.css");

.recalc-editor {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    color: var(--color-text);
    background: var(--color-background);
    min-height: 100vh;
}

.editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
}

.editor-header h1 {
    margin: 0;
    font-size: 1.8rem;
    color: var(--color-text-secondary);
    text-align: left;
}

.header-actions {
    display: flex;
    gap: 0.5rem;
}

/* ─── Tabs ─────────────────────────────────────────────────────────── */
.tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-border);
    margin-bottom: 1.5rem;
}

.tab {
    padding: 0.6rem 1.2rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    color: var(--color-text-tertiary);
    font-size: 0.9rem;
    cursor: pointer;
}

.tab:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
}

.tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}

/* ─── Cards ────────────────────────────────────────────────────────── */
.card {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin-bottom: 0.75rem;
    overflow: hidden;
}

.card :deep(.collapsible-section) {
    margin: 0;
}

.card :deep(.collapsible-header) {
    padding: 0.6rem 1rem;
    background: var(--color-background-tertiary);
}

.card :deep(.collapsible-content) {
    padding: 0.75rem 1rem;
    border-left: none;
}

.card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.5rem;
}

.card-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--color-text);
}

/* ─── Field rows ───────────────────────────────────────────────────── */
.field-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    flex-wrap: wrap;
}

.setting-group.flex-grow {
    flex: 2;
}

.checkbox-group {
    display: flex;
    align-items: flex-end;
    min-width: auto;
    flex: 0;
}

.checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0;
    padding: 0.6rem 0;
    cursor: pointer;
    font-size: 0.85rem;
    white-space: nowrap;
}

.checkbox-group input[type="checkbox"] {
    width: auto;
    margin: 0;
    cursor: pointer;
}

.btn-icon {
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--color-text-tertiary);
    padding: 0.3rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
}

.btn-icon:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
}

.btn-port-link {
    color: var(--color-primary);
}

.btn-port-link:hover {
    background: rgba(16, 163, 127, 0.1);
}

/* ─── Constraint rows ──────────────────────────────────────────────── */
.constraint-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

/* ─── Pins ─────────────────────────────────────────────────────────── */
.sub-section {
    margin-bottom: 1rem;
}

.sub-section h3 {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin: 0 0 0.5rem 0;
    font-weight: 600;
}

.pin-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
    padding: 0.3rem 0;
}

.pin-label {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    min-width: 140px;
    white-space: nowrap;
}

.signal-input-wrapper {
    flex: 1;
    display: flex;
    gap: 0.3rem;
    align-items: center;
}

.signal-input-wrapper input {
    flex: 1;
    padding: 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 0.9rem;
    transition: border-color 0.2s;
    box-sizing: border-box;
}

.signal-input-wrapper input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.signal-input-wrapper input::placeholder {
    color: var(--color-text-muted);
}

.port-badge {
    font-size: 0.75rem;
    color: var(--color-primary);
    background: rgba(16, 163, 127, 0.1);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
}

/* ─── Recalc fields ────────────────────────────────────────────────── */
.recalc-fields {
    padding: 0.75rem;
    background: var(--color-background-tertiary);
    border-radius: 6px;
    border: 1px dashed var(--color-border-light);
}

.recalc-fields .setting-group {
    margin-bottom: 1rem;
}

.recalc-fields .setting-group:last-of-type {
    margin-bottom: 0.5rem;
}

/* ─── Badge ────────────────────────────────────────────────────────── */
.badge {
    font-size: 0.7rem;
    background: rgba(16, 163, 127, 0.15);
    color: var(--color-primary);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
}

/* ─── Add parameter row ────────────────────────────────────────────── */
.add-parameter-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    margin-top: 0.5rem;
}

.add-parameter-row .setting-group {
    flex: 1;
    margin-bottom: 0;
}

.add-parameter-row .setting-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.95rem;
}

/* ─── JSON Preview ─────────────────────────────────────────────────── */
.json-preview {
    margin-top: 2rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
}

.json-preview :deep(.collapsible-header) {
    padding: 0.6rem 1rem;
    background: var(--color-background-tertiary);
}

.json-preview :deep(.collapsible-content) {
    border-left: none;
}

.json-content {
    padding: 1rem;
    background: var(--color-background-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
    margin: 0;
    color: var(--color-text-secondary);
    white-space: pre;
}

/* ─── Section description code ─────────────────────────────────────── */
.section-description code {
    background: var(--color-background-tertiary);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.8rem;
    color: var(--color-primary);
}

/* ─── Global Replace Card ──────────────────────────────────────────── */
.global-replace-card {
    margin-bottom: 1.5rem;
    overflow: visible;
    position: relative;
    z-index: 10;
}

.button-group {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
}
</style>

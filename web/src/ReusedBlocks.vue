<template>
    <div class="recalc-editor">
        <header class="editor-header">
            <h1>Reused Blocks</h1>
            <div class="header-actions">
                <template v-if="activeMainTab === 'export'">
                    <IconButton icon="Download" @click="loadFromEasyEDA" title="Load from EasyEDA" />
                    <IconButton icon="FileDown" @click="loadFromFile" title="Load from file" />
                    <IconButton icon="Save" @click="saveToFile" title="Save to file" />
                    <IconButton icon="Sparkles" @click="autoFill" title="Auto fill with AI" :disabled="isAutoFilling" />
                    <IconButton icon="Database" @click="addBlock" title="Add to database" :disabled="isAddingBlock" />
                </template>
            </div>
        </header>

        <div class="main-tabs">
            <IconButton :class="['main-tab', { active: activeMainTab === 'browse' }]" icon="Database"
                @click="activeMainTab = 'browse'">Browse</IconButton>
            <IconButton :class="['main-tab', { active: activeMainTab === 'export' }]" icon="FileDown"
                @click="activeMainTab = 'export'">Export</IconButton>
        </div>

        <section v-if="activeMainTab === 'browse'" class="browse-view">
            <section class="browse-panel">
                <h2>Reused Blocks</h2>
                <p>Read-only catalog of reusable recalculation blocks.</p>
                <div class="browse-toolbar">
                    <input v-model="browseSearch" type="search"
                        placeholder="Filter current page by name, id, category or tag" />
                    <CustomSelect v-model="browseValidatedFilter" :options="browseValidatedOptions" />
                    <CustomSelect v-model="browseLimit" :options="browseLimitOptions"
                        @update:model-value="changeBrowseLimit" />
                    <IconButton icon="RotateCw" variant="primary" :disabled="browseState.busy"
                        @click="loadBrowseBlocks">Refresh</IconButton>
                </div>
                <div class="browse-pager">
                    <IconButton icon="ArrowLeft" :disabled="browseState.offset <= 0 || browseState.busy"
                        @click="prevBrowsePage">Prev</IconButton>
                    <div class="browse-pager-info">{{ browsePageInfo }}</div>
                    <IconButton icon="ArrowRight"
                        :disabled="browseState.offset + browseState.limit >= browseState.total || browseState.busy"
                        @click="nextBrowsePage">Next</IconButton>
                </div>
                <div class="browse-hint">
                    Read-only mode. The page requests data from the server with offset/limit. Search and status filter
                    are applied to the loaded page.
                </div>
            </section>

            <section class="browse-stats">
                <div class="browse-card browse-stat"><strong>{{ browseState.total }}</strong><span>Total blocks in DB</span></div>
                <div class="browse-card browse-stat"><strong>{{ browseState.blocks.length }}</strong><span>Loaded this page</span></div>
                <div class="browse-card browse-stat"><strong>{{ visibleBrowseBlocks.length }}</strong><span>Visible after filter</span></div>
            </section>

            <section class="browse-list">
                <article v-for="block in visibleBrowseBlocks" :key="block.id" class="browse-card browse-block-card">
                    <div class="browse-block-head">
                        <div>
                            <h3>{{ block.name }}</h3>
                            <div class="browse-meta">{{ block.id }}; {{ block.category }}; updated {{ formatDate(block.updated_at) }}</div>
                        </div>
                        <div class="browse-actions">
                            <span class="browse-tag">{{ block.validated ? 'validated' : 'not validated' }}</span>
                            <IconButton icon="Download" @click="downloadBlock(block.id, 'asm')">ASM JSON</IconButton>
                            <IconButton icon="FileDown" @click="downloadBlock(block.id)">DB JSON</IconButton>
                        </div>
                    </div>
                    <p class="browse-description">{{ block.description || 'No description' }}</p>
                    <div class="browse-tags">
                        <span v-for="item in browseBlockTags(block)" :key="item" class="browse-tag">{{ item }}</span>
                    </div>
                </article>

                <div v-if="!visibleBrowseBlocks.length" class="browse-card browse-empty">
                    No blocks found for the current page/filter.
                </div>
            </section>
            <p class="browse-status">{{ browseStatus }}</p>
        </section>

        <template v-else>

        <!-- METADATA SECTION -->
        <section class="metadata-section">
            <Collapsible title="Block Metadata" :default-open="true">
                <div class="setting-group">
                    <label for="block-name">Block Name</label>
                    <input id="block-name" type="text" v-model="data.name" placeholder="e.g. Buck Converter" />
                </div>
                <div class="setting-group">
                    <label for="block-desc">Description</label>
                    <!-- <input id="block-desc" type="text" v-model="data.description"
                        placeholder="e.g. 5V/3A buck converter circuit" /> -->

                    <AdjTextarea id="block-desc" v-model="data.description"
                        placeholder="e.g. 5V/3A buck converter circuit" />
                </div>

                <div class="setting-group">
                    <label for="block-category">Category</label>
                    <CustomSelect id="block-category" v-model="data.category" :options="reusedCategoryOptions" />
                </div>
                <div class="setting-group">
                    <label for="block-tags">Tags</label>
                    <div class="tag-picker">
                        <CustomSelect id="block-tags" v-model="selectedTag" :options="availableTagOptions" />
                        <IconButton icon="Plus" variant="ghost" :size="14" :disabled="!selectedTag"
                            @click="addSelectedTag" title="Add tag" />
                    </div>
                    <div v-if="data.tags.length" class="selected-tags">
                        <button v-for="tag in data.tags" :key="tag" type="button" class="tag-chip"
                            @click="removeTag(tag)" :title="`Remove ${formatDisplayToken(tag)}`">
                            <span>{{ formatDisplayToken(tag) }}</span>
                            <Icon name="X" :size="12" />
                        </button>
                    </div>
                </div>
            </Collapsible>
        </section>

        <!-- TABS -->
        <div class="tabs">
            <button :class="['tab', { active: activeTab === 'ports' }]" @click="activeTab = 'ports'">Ports</button>
            <button :class="['tab', { active: activeTab === 'parameters' }]"
                @click="activeTab = 'parameters'">Parameters</button>
            <!-- <button :class="['tab', { active: activeTab === 'constraints' }]"
                @click="activeTab = 'constraints'">Constraints</button> -->
            <button :class="['tab', { active: activeTab === 'components' }]"
                @click="activeTab = 'components'">Components</button>
        </div>

        <!-- PORTS TAB -->
        <section v-if="activeTab === 'ports'" class="tab-content">
            <h2>Ports</h2>
            <p class="section-description">Define circuit ports. Ports are bound to nets (signal_name) via the
                {PORT_XXX} template.</p>

            <div v-for="(port, idx) in data.circuit.recalculation_meta.ports" :key="idx" class="card">
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

            <div v-for="(param, key) in data.circuit.recalculation_meta.parameters" :key="key" class="card">
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
        <!-- <section v-if="activeTab === 'constraints'" class="tab-content">
            <h2>Constraints</h2>
            <p class="section-description">Constraints as string expressions (e.g. "Vout &lt; 8").</p>

            <div v-for="(constraint, idx) in data.circuit.recalculation_meta.constraints" :key="idx" class="constraint-row">
                <div class="setting-group flex-grow">
                    <label for="constraint-{{ idx }}">Constraint</label>
                    <input :id="'constraint-' + idx" type="text" v-model="data.circuit.recalculation_meta.constraints[idx]"
                        placeholder="Vout < 8" />
                </div>
                <IconButton icon="Trash2" variant="remove" @click="removeConstraint(idx)" title="Remove" :size="14" />
            </div>

            <IconButton icon="Plus" variant="primary" :size="14" @click="addConstraint">Add Constraint</IconButton>
        </section> -->

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
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watchEffect } from 'vue';
import Icon from './components/shared/Icon.vue';
import IconButton from './components/shared/IconButton.vue';
import Collapsible from './components/shared/Collapsible.vue';
import CustomSelect from './components/shared/CustomSelect.vue';
import { ReusedCategory, ReusedTags, type CircuitAssemblyWithRecalc } from '@copilot/shared/types/reused';
import { useSettingsStore } from './stores/settings-store';
import { setTheme } from './composables/useTheme';
import { ThemeName } from './theme/themes';
import { fetchEda, apiUrl, authorization } from './api/index';
import { makeLLmSettings } from './utils/llm-settings';
import "@copilot/shared/types/eda";
import AdjTextarea from './components/shared/AdjTextarea.vue';

const settingsStore = useSettingsStore();

// Constants
const unknown_shortsym = 'unknown_shortsym';
const reusedBlocksApiBasePath = '/reused-blocks/api';

type BrowseBlock = {
    id: string;
    name: string;
    description?: string;
    category: string;
    tags?: string[];
    validated: boolean;
    updated_at?: number;
    parameterNames?: string[];
};

// Инициализировать тему при загрузке приложения
onMounted(() => {
    settingsStore.loadSettings();
    setTheme((settingsStore.getSetting('theme') || 'light') as ThemeName);

    watchEffect(() => {
        const theme = settingsStore.getSetting('theme') || 'light';
        setTheme(theme as ThemeName);
    });

    loadBrowseBlocks();
});

// ─── State ───────────────────────────────────────────────────────────
const activeMainTab = ref<'browse' | 'export'>('browse');
const activeTab = ref<'ports' | 'parameters' | 'constraints' | 'components'>('ports');
const newParamName = ref('');
const isAutoFilling = ref(false);
const isAddingBlock = ref(false);
const selectedTag = ref('');
const browseSearch = ref('');
const browseValidatedFilter = ref<'all' | 'true' | 'false'>('all');
const browseStatus = ref('');
const browseState = reactive({
    blocks: [] as BrowseBlock[],
    total: 0,
    offset: 0,
    limit: 25,
    busy: false,
});
const browseValidatedOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'true', label: 'Validated only' },
    { value: 'false', label: 'Not validated' },
];
const browseLimitOptions = [
    { value: '25', label: '25 per page' },
    { value: '50', label: '50 per page' },
    { value: '100', label: '100 per page' },
];

const reusedCategoryValues = ReusedCategory().options;
const reusedTagValues = ReusedTags().options;
const reusedCategorySet = new Set<string>(reusedCategoryValues);
const reusedTagSet = new Set<string>(reusedTagValues);

const formatDisplayToken = (value: string) => value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const reusedCategoryOptions = reusedCategoryValues.map(value => ({
    value,
    label: formatDisplayToken(value),
}));

const reusedTagOptions = reusedTagValues.map(value => ({
    value,
    label: formatDisplayToken(value),
}));

const EMPTY_DATA = {
    name: '',
    description: '',
    category: '',
    tags: [] as string[],

    circuit: {
        recalculation_meta: {
            parameters: {},
            // constraints: [],
            ports: [],
        },
        components: [],
        blocks_rect: [],
        blocks: [],
        edges: [],
    } as CircuitAssemblyWithRecalc
};

let data = reactive(structuredClone(EMPTY_DATA));

// Filtered components (skip unknown_shortsym and designators with |)
const filteredComponents = computed(() => {
    return data.circuit.components.filter(
        comp => comp.value !== unknown_shortsym && !comp.designator.includes('|')
    );
});

// Get all unique signal names as options for CustomSelect
const signalNameOptions = computed(() => {
    const names = new Set<string>();
    for (const comp of data.circuit.components) {
        for (const pin of comp.pins) {
            if (pin.signal_name) {
                names.add(pin.signal_name);
            }
        }
    }
    return Array.from(names).sort().map(name => ({ value: name, label: name }));
});

const availableTagOptions = computed(() => {
    const selected = new Set(data.tags);
    return reusedTagOptions.filter(option => !selected.has(option.value));
});

const visibleBrowseBlocks = computed(() => {
    const query = browseSearch.value.trim().toLowerCase();
    const validatedFilter = browseValidatedFilter.value;

    return browseState.blocks.filter((block) => {
        const matchesValidated =
            validatedFilter === 'all' ||
            String(block.validated) === validatedFilter;

        if (!matchesValidated) return false;
        if (!query) return true;

        const haystack = [
            block.id,
            block.name,
            block.description,
            block.category,
            ...(block.tags || []),
            ...(block.parameterNames || []),
        ].join(' ').toLowerCase();

        return haystack.includes(query);
    });
});

const browsePageInfo = computed(() => {
    const page = Math.floor(browseState.offset / browseState.limit) + 1;
    const from = browseState.total === 0 ? 0 : browseState.offset + 1;
    const to = Math.min(browseState.offset + browseState.blocks.length, browseState.total);
    return `Page ${page} - showing ${from}-${to} of ${browseState.total}`;
});

const browseLimit = computed({
    get: () => String(browseState.limit),
    set: (value: string) => {
        browseState.limit = Number(value);
    },
});

function addSelectedTag() {
    if (!selectedTag.value || !reusedTagSet.has(selectedTag.value) || data.tags.includes(selectedTag.value)) return;
    data.tags.push(selectedTag.value);
    selectedTag.value = '';
}

function removeTag(tag: string) {
    data.tags = data.tags.filter(value => value !== tag);
}

function normalizeTags(tags: string[] | undefined): string[] {
    if (!Array.isArray(tags)) return [];
    return Array.from(new Set(tags.filter(tag => reusedTagSet.has(tag))));
}

function formatDate(timestamp?: number) {
    if (!timestamp) return 'unknown';
    return new Date(timestamp).toLocaleString();
}

function browseBlockTags(block: BrowseBlock) {
    return [block.category, ...(block.tags || []), ...(block.parameterNames || [])].filter(Boolean);
}

function downloadBlockHref(id: string, type?: 'asm') {
    const suffix = type ? '?type=asm' : '';
    return `${apiUrl}${reusedBlocksApiBasePath}/blocks/${encodeURIComponent(id)}/download${suffix}`;
}

function downloadBlock(id: string, type?: 'asm') {
    window.location.href = downloadBlockHref(id, type);
}

async function loadBrowseBlocks() {
    if (browseState.busy) return;
    browseState.busy = true;
    browseStatus.value = 'Loading blocks...';

    try {
        const params = new URLSearchParams({
            offset: String(browseState.offset),
            limit: String(browseState.limit),
        });
        const response = await fetchEda(`${apiUrl}${reusedBlocksApiBasePath}/blocks?${params.toString()}`, {
            headers: { 'Authorization': authorization },
        });
        if (!response.ok) {
            throw new Error('Failed to load blocks');
        }
        const payload = await response.json();
        browseState.blocks = payload.blocks || [];
        browseState.total = payload.total || 0;
        browseState.offset = payload.offset || 0;
        browseState.limit = payload.limit || browseState.limit;
        browseStatus.value = `Loaded ${browseState.blocks.length} blocks.`;
    } catch (error) {
        browseStatus.value = error instanceof Error ? error.message : 'Failed to load blocks';
    } finally {
        browseState.busy = false;
    }
}

function changeBrowseLimit() {
    browseState.offset = 0;
    loadBrowseBlocks();
}

function prevBrowsePage() {
    if (browseState.offset <= 0 || browseState.busy) return;
    browseState.offset = Math.max(0, browseState.offset - browseState.limit);
    loadBrowseBlocks();
}

function nextBrowsePage() {
    if (browseState.offset + browseState.limit >= browseState.total || browseState.busy) return;
    browseState.offset += browseState.limit;
    loadBrowseBlocks();
}

// State for global signal name replacement
const selectedSignalName = ref('');
const newSignalName = ref('');

// ─── Ports ───────────────────────────────────────────────────────────
function addPort() {
    data.circuit.recalculation_meta.ports.push({
        port_number: '',
        description: '',
        related_parameter: null,
    });
}

function removePort(idx: number) {
    data.circuit.recalculation_meta.ports.splice(idx, 1);
}

// ─── Parameters ──────────────────────────────────────────────────────
function addParameter() {
    const name = newParamName.value.trim();
    if (!name) return;
    data.circuit.recalculation_meta.parameters[name] = {
        min: 0,
        nominal: 0,
        max: 0,
        allow_recalc: false,
    };
    newParamName.value = '';
}

function removeParameter(key: string) {
    delete data.circuit.recalculation_meta.parameters[key];
}

// ─── Constraints ─────────────────────────────────────────────────────
// function addConstraint() {
//     data.circuit.recalculation_meta.constraints.push('');
// }

// function removeConstraint(idx: number) {
//     data.circuit.recalculation_meta.constraints.splice(idx, 1);
// }

// ─── Components ──────────────────────────────────────────────────────
function onSignalNameChange(oldSignal: string, newSignal: string) {
    for (const c of data.circuit.components) {
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
    const port = data.circuit.recalculation_meta.ports.find(p => p.port_number === portName);
    if (port) return;
    data.circuit.recalculation_meta.ports.push({
        port_number: portName,
        description: '',
        related_parameter: null,
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

    for (const comp of data.circuit.components) {
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
                ...data.circuit,
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
                'Authorization': authorization,
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

async function addBlock() {
    if (isAddingBlock.value) return;

    if (!data.name.trim()) {
        alert('Please enter block name before adding to database');
        return;
    }
    if (!reusedCategorySet.has(data.category)) {
        alert('Please select a valid category before adding to database');
        return;
    }

    isAddingBlock.value = true;

    try {
        const payload = {
            name: data.name,
            description: data.description,
            category: data.category,
            tags: data.tags,
            circuit: data.circuit,
        };

        const res = await fetchEda(apiUrl + '/add-reused-block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to add block: ${res.status} ${errorText}`);
        }

        const result = await res.json();
        alert('Block added to database successfully');
    } catch (err) {
        alert('Error adding block: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
        isAddingBlock.value = false;
    }
}

// ─── File I/O ────────────────────────────────────────────────────────
async function loadFromEasyEDA() {
    try {
        const eda = (window as any).eda;
        if (!eda?.getAsmCircuit) {
            alert('EasyEDA API not available');
            return;
        }

        const circuit = await eda.getAsmCircuit();
        if (!circuit) {
            alert('No circuit data received from EasyEDA');
            return;
        }

        applyData(circuit, true);
        alert('Loaded circuit from EasyEDA successfully');
    } catch (err) {
        alert('Failed to load from EasyEDA: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
}

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
            applyData({ ...parsed, ...parsed.circuit }, true);
        } catch (err) {
            alert('Failed to load file: ' + (err instanceof Error ? err.message : 'Invalid format'));
        } finally {
            document.body.removeChild(input);
        }
    };

    document.body.appendChild(input);
    input.click();
}

function applyData(parsed: Partial<CircuitAssemblyWithRecalc & { name: string, description: string, category: string, tags: string[] }>, clean?: boolean) {
    if (clean) {
        data.category = EMPTY_DATA.category;
        data.circuit = structuredClone(EMPTY_DATA.circuit);
        data.description = EMPTY_DATA.description;
        data.name = EMPTY_DATA.name;
        data.tags = [];
    }

    if (parsed.recalculation_meta) {
        const meta = parsed.recalculation_meta;
        data.circuit.recalculation_meta.parameters = meta.parameters ?? {};
        // data.circuit.recalculation_meta.constraints = meta.constraints ?? [];
        data.circuit.recalculation_meta.ports = meta.ports ?? [];
    }
    if (Array.isArray(parsed.components)) {
        data.circuit.components = parsed.components;
    }
    if (parsed.blocks_rect) data.circuit.blocks_rect = parsed.blocks_rect;
    if (parsed.blocks) data.circuit.blocks = parsed.blocks;
    if (parsed.edges) data.circuit.edges = parsed.edges;

    if (parsed.name) data.name = parsed.name;
    if (parsed.description) data.description = parsed.description;
    if (parsed.category && reusedCategorySet.has(parsed.category)) data.category = parsed.category;
    if (parsed.tags) data.tags = normalizeTags(parsed.tags);

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
    gap: 0.3rem;
}

.main-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-border);
    margin-bottom: 1.5rem;
}

.main-tab {
    padding: 0.7rem 1.4rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    color: var(--color-text-tertiary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}

.main-tab:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
}

.main-tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}

.browse-view {
    display: grid;
    gap: 1.25rem;
}

.browse-panel,
.browse-card {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
}

.browse-panel {
    padding: 1rem;
}

.browse-panel h2,
.browse-block-card h3 {
    margin: 0 0 0.4rem;
    color: var(--color-text);
}

.browse-panel p {
    margin: 0;
    color: var(--color-text-secondary);
}

.browse-toolbar,
.browse-pager,
.browse-actions,
.browse-tags,
.browse-stats {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
}

.browse-toolbar,
.browse-pager {
    margin-top: 1rem;
}

.browse-toolbar input,
.browse-toolbar button,
.browse-pager button {
    font: inherit;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    padding: 0.55rem 0.75rem;
    background: var(--color-background);
    color: var(--color-text);
}

.browse-toolbar :deep(.custom-select-wrapper) {
    width: auto;
    min-width: 150px;
}

.browse-toolbar :deep(.custom-select-button) {
    min-height: 37px;
}

.browse-toolbar input {
    min-width: 240px;
    flex: 1 1 320px;
}

.browse-toolbar button,
.browse-pager button {
    cursor: pointer;
}

.browse-toolbar button {
    background: var(--color-primary);
    color: var(--color-primary-text, #fff);
    border-color: var(--color-primary);
}

.browse-pager button:disabled,
.browse-toolbar button:disabled {
    cursor: default;
    opacity: 0.55;
}

.browse-pager-info,
.browse-hint,
.browse-meta,
.browse-description,
.browse-status,
.browse-empty {
    color: var(--color-text-secondary);
}

.browse-pager-info {
    min-width: 180px;
}

.browse-hint {
    margin-top: 0.75rem;
    font-size: 0.85rem;
}

.browse-stat {
    padding: 0.85rem 1rem;
    min-width: 150px;
}

.browse-stat strong {
    display: block;
    font-size: 1.35rem;
    margin-bottom: 0.25rem;
}

.browse-stat span {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
}

.browse-list {
    display: grid;
    gap: 1rem;
}

.browse-block-card {
    padding: 1rem;
}

.browse-block-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.75rem;
}

.browse-actions {
    justify-content: flex-end;
}

.browse-description {
    margin: 0.65rem 0 0.85rem;
    line-height: 1.5;
    white-space: pre-wrap;
}

.browse-tag {
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    background: var(--color-background-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
}

.browse-empty {
    text-align: center;
    padding: 2.5rem 1rem;
}

@media (max-width: 720px) {
    .browse-block-head {
        flex-direction: column;
    }

    .browse-actions {
        justify-content: flex-start;
    }
}

/* ─── Metadata Section ─────────────────────────────────────────────── */
.metadata-section {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin-bottom: 1.5rem;
    overflow: visible;
    position: relative;
    z-index: 30;
}

.metadata-section :deep(.collapsible-section) {
    margin: 0;
    position: relative;
}

.metadata-section :deep(.collapsible-header) {
    padding: 0.6rem 1rem;
    background: var(--color-background-tertiary);
}

.metadata-section :deep(.collapsible-content) {
    padding: 0.75rem 1rem;
    border-left: none;
    overflow: visible;
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

.tag-picker {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
}

.tag-picker :deep(.custom-select-wrapper) {
    flex: 1;
}

.selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
}

.tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0.2rem 0.45rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background-tertiary);
    color: var(--color-text);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
}

.tag-chip:hover {
    border-color: var(--color-error);
    color: var(--color-error);
}

.tag-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#block-desc {
    width: 100%;
    padding: 0.75rem;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 0.9rem;
    transition: border-color 0.2s;
    box-sizing: border-box;
}
</style>

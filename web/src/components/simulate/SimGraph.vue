<template>
    <!-- Transient Analysis -->
    <div style="height: 100%;" v-if="simulationResult.result.type === 'transient'">
        <VoltageChart ref="voltageChartRefs" variant="transient" :time="simulationResult.result.time"
            :signals="simulationResult.result.output_signals.map(s => ({ name: s.signal_name, data: s.voltages }))"
            x-label="Time" y-label="Voltage (V)" :grid="true" :show-legend="true" />
        <p class="result-description">Transient Analysis: Time-domain response</p>
    </div>

    <!-- AC Analysis -->
    <div style="height: 100%;" v-else-if="simulationResult.result.type === 'ac'">
        <VoltageChart ref="voltageChartRefs" variant="ac" :time="simulationResult.result.frequencies"
            :signals="simulationResult.result.output_signals.map(s => ({ name: s.signal_name, data: s.magnitude }))"
            x-label="Frequency" y-label="Magnitude (dB)" :grid="true" :show-legend="true" />
        <p class="result-description">AC Analysis: Frequency response (magnitude)</p>
    </div>

    <!-- DC Sweep -->
    <div style="height: 100%;" v-else-if="simulationResult.result.type === 'dc'">
        <VoltageChart ref="voltageChartRefs" variant="dc" :time="simulationResult.result.sweep_values"
            :signals="simulationResult.result.output_signals.map(s => ({ name: s.signal_name, data: s.voltages }))"
            x-label="Source Voltage" y-label="Output Voltage (V)" :grid="true" :show-legend="true" />
        <p class="result-description">DC Sweep: Output vs Source Voltage</p>
    </div>

    <!-- Operating Point -->
    <div style="height: 100%;" v-else-if="simulationResult.result.type === 'op'">
        <div class="op-results-table">
            <div class="op-header">
                <span>Signal Name</span>
                <span>Voltage (V)</span>
            </div>
            <div v-for="signal in simulationResult.result.output_signals" :key="signal.signal_name" class="op-row">
                <span>{{ signal.signal_name }}</span>
                <span>{{ signal.voltage?.toFixed(6) ?? 'N/A' }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import VoltageChart from '../shared/VoltageChart.vue';
import { SimulateResult } from '../../types/spice';

const props = defineProps<{ simulationResult: SimulateResult }>()
</script>


<style scoped>
.op-results-table {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--color-background);
    border-radius: 4px;
}

.op-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 0.5rem;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--color-text);
    border-bottom: 2px solid var(--color-border);
}

.op-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 0.5rem;
    font-size: 0.85rem;
    border-bottom: 1px solid var(--color-border);
}

.op-row:last-child {
    border-bottom: none;
}

.op-row span:first-child {
    font-weight: 500;
    color: var(--color-text);
}

.op-row span:last-child {
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
}
</style>
<template>
    <div id="app">
        <div style="height: 100vh; display: flex; flex-direction: column;">
            <VoltageChart :time="time" :signals="signals" grid />
        </div>
    </div>
</template>

<script setup lang="ts">
import VoltageChart from './components/shared/VoltageChart.vue';

declare global {
    interface EDA {
        chartData?: {
            time: number[];
            signals: { data: number[]; name: string }[];
        };
    }
}

const time = eda.chartData?.time ?? [];
const signals = eda.chartData?.signals ?? [];

</script>

<style scoped></style>
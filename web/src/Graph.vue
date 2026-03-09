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

<style>
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: var(--color-background);
    color: var(--color-text);
}

html,
body {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
    /* блокируем прокрутку на body/html */
}
</style>
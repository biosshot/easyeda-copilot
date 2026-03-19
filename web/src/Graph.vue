<template>
    <div id="app">
        <div style="height: 100vh; display: flex; flex-direction: column;">
            <SimGraph style="height: 100vh;" :simulation-result="simulationResult!"></SimGraph>
        </div>
    </div>
</template>

<script setup lang="ts">
import SimGraph from './components/simulate/SimGraph.vue';
import "./types/eda";

const simulationResult = eda.simulationResult;

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
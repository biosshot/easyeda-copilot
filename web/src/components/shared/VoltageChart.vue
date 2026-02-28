<template>
    <VChart class="chart" ref="chartRef" :option="chartOption" autoresize />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { useMagicKeys } from '@vueuse/core'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, DataZoomComponent]);

const props = defineProps<{ time: number[], data: number[], syncTime?: boolean }>();
const emit = defineEmits<{
    syncZoom: [start: number, end: number]
}>();

const { shift } = useMagicKeys()
const chartRef = ref<InstanceType<typeof VChart> | null>(null);

const zoomState = ref({
    x: { start: 0, end: 100 },
    y: { start: 0, end: 100 }
})

const data = props.time.map((num1, index) => [num1, props.data[index]]);

const chartOption = ref({
    tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'line' }
    },
    xAxis: {
        type: 'value',
        name: 'Time (ms)',
        scale: true,
        min: null,
        max: null,
        axisLabel: {
            formatter: (value: number) => value.toFixed(2)
        }
    },
    yAxis: {
        type: 'value',
        name: 'Voltage (V)',
        scale: true,
        min: Math.min(...props.data) - 4,
        max: Math.max(...props.data) + 4,
        axisLabel: {
            formatter: (value: number) => value.toFixed(2)
        }
    },
    series: [
        {
            data,
            type: 'line',
            showSymbol: false,
            large: true,
            largeThreshold: 2000,
            hoverAnimation: false,
            animation: false,
            sampling: 'none',
            lineStyle: { width: 1 },
            progressive: 10000,
            progressiveThreshold: 20000
        }
    ],
    dataZoom: [
        {
            type: 'inside',
            xAxisIndex: 0,
            yAxisIndex: null,
            start: 0,
            end: 100,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            filterMode: 'none'
        },
        {
            type: 'inside',
            xAxisIndex: null,
            yAxisIndex: 0,
            start: 0,
            end: 100,
            zoomOnMouseWheel: false,
            moveOnMouseMove: true,
            filterMode: 'none'
        }
    ]
})

onMounted(() => {
    const chart = chartRef.value?.chart

    if (chart) {
        chart.on('dataZoom', (params) => {
            if (!params || typeof params !== 'object' || !('batch' in params)) return;
            if (!Array.isArray(params.batch)) return;

            if (!params.batch || !params.batch[0]) return

            const { start, end } = params.batch[0]

            if (shift.value) {
                zoomState.value.y = { start, end }
            } else {
                zoomState.value.x = { start, end }
            }

            if (props.syncTime && !shift.value) {
                emit('syncZoom', start, end)
            }
        })
    }
})

// Слушаем внешние события синхронизации
const handleExternalSync = (start: number, end: number) => {
    if (!props.syncTime) return;

    zoomState.value.x = { start, end };

    chartOption.value.dataZoom[0] = {
        ...chartOption.value.dataZoom[0],
        start,
        end,
    }
}

defineExpose({
    handleExternalSync
})

watch(shift, (isShiftPressed) => {
    chartOption.value.dataZoom = [
        {
            ...chartOption.value.dataZoom[0],
            start: zoomState.value.x.start,
            end: zoomState.value.x.end,
            zoomOnMouseWheel: !isShiftPressed,
        },
        {
            ...chartOption.value.dataZoom[1],
            start: zoomState.value.y.start,
            end: zoomState.value.y.end,
            zoomOnMouseWheel: isShiftPressed,
        },
    ]

}, { immediate: true })

watch(() => props.syncTime, (newSyncTime) => {
    if (newSyncTime && chartRef.value?.chart) {
        chartOption.value.dataZoom = [
            {
                ...chartOption.value.dataZoom[0],
                start: zoomState.value.x.start,
                end: zoomState.value.x.end,
            },
            {
                ...chartOption.value.dataZoom[1],
                start: zoomState.value.y.start,
                end: zoomState.value.y.end,
            },
        ]
    }
})

</script>

<style scoped>
.chart {
    height: 400px;
}
</style>
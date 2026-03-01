<template>
    <VChart class="chart" ref="chartRef" :option="chartOption" autoresize />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef } from 'vue';
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
    x: { start: 0, end: 20 },
    y: { start: 0, end: 100 }
})

const data = props.time.map((num1, index) => [num1, props.data[index]]);

function findMinMax(arr: number[]) {
    if (arr.length === 0) {
        return { min: 0, max: 0 };
    }

    let min = arr[0];
    let max = arr[0];

    for (let i = 1; i < arr.length; i++) {
        const value = arr[i];
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }

    return { min, max };
}

const { min, max } = findMinMax(props.data)

const chartOption = shallowRef({
    tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'line' }
    },
    xAxis: {
        type: 'value',
        name: 'T (ms)',
        scale: true,
        min: null,
        max: null,
        axisLabel: {
            formatter: (value: number) => value.toFixed(2)
        }
    },
    yAxis: {
        type: 'value',
        name: 'V (V)',
        scale: true,
        min: min - 4,
        max: max + 4,
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
            progressive: 3000,
            progressiveThreshold: 3000,
            clip: true
        }
    ],
    dataZoom: [
        {
            type: 'inside',
            xAxisIndex: 0,
            yAxisIndex: null,
            start: 0,
            end: 20,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            filterMode: 'weakFilter',
            throttle: 50
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
    const chart = chartRef.value?.chart;
    if (!chart) return;

    zoomState.value.x = { start, end };

    chart.setOption({
        dataZoom: [
            {
                start,
                end,
            }
        ]
    });
}

defineExpose({
    handleExternalSync
})

watch(shift, (isShiftPressed) => {
    const chart = chartRef.value?.chart;
    if (!chart) return;

    chart.setOption({
        dataZoom: [
            {
                start: zoomState.value.x.start,
                end: zoomState.value.x.end,
                zoomOnMouseWheel: !isShiftPressed,
            },
            {
                start: zoomState.value.y.start,
                end: zoomState.value.y.end,
                zoomOnMouseWheel: isShiftPressed,
            }
        ]
    });

}, { immediate: true })

watch(() => props.syncTime, (newSyncTime) => {
    const chart = chartRef.value?.chart;
    if (!chart) return;

    if (newSyncTime && chartRef.value?.chart) {
        chart.setOption({
            dataZoom: [
                {
                    start: zoomState.value.x.start,
                    end: zoomState.value.x.end,
                },
                {
                    start: zoomState.value.y.start,
                    end: zoomState.value.y.end,
                }
            ]
        });
    }
})

</script>

<style scoped>
.chart {
    height: 400px;
}
</style>
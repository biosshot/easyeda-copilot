<template>
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column">
        <div :style="{
            padding: '8px',
            background: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px'
        }">
            <label v-for="signal in signals" :key="signal.name" style="display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" :checked="visibility[signal.name] !== false"
                    @change="toggleSignal(signal.name)" />
                <span :style="{ color: getColor(signal.name) }">{{ signal.name }}</span>
            </label>
        </div>

        <div style="
        flex: 1;
        display: grid;
        grid-template-rows: 1fr 2.5em;
        grid-template-columns: 6em 1fr;
        gap: 0;
        position: relative;
      ">
            <div :style="{ borderRight: `solid 2px ${theme.colors.border}` }">
                <canvas ref="axisYCanvas"
                    :style="{ backgroundColor: theme.colors.background, width: '100%', height: '100%', display: 'block' }"></canvas>
            </div>

            <div style="position: relative">
                <canvas ref="plotCanvas"
                    :style="{ backgroundColor: theme.colors.background, width: '100%', height: '100%', display: 'block' }"></canvas>
                <canvas v-if="grid" ref="gridCanvas"
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; pointer-events: none;"></canvas>
            </div>

            <div
                :style="{ borderRight: `solid 2px ${theme.colors.border}`, borderTop: `solid 2px ${theme.colors.border}` }">
            </div>

            <div :style="{ borderTop: `solid 2px ${theme.colors.border}` }">
                <canvas ref="axisXCanvas"
                    :style="{ backgroundColor: theme.colors.background, width: '100%', height: '100%', display: 'block' }"></canvas>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { WebglPlot, ColorRGBA, WebglLine } from 'webgl-plot';
import { useTheme } from '../../composables/useTheme';

const props = defineProps<{
    time: number[];
    signals: { data: number[]; name: string }[];
    grid?: boolean;
}>();

// Тема
const { theme } = useTheme();

// Видимость сигналов
const visibility = ref<Record<string, boolean>>({});
watch(() => props.signals, (newSignals) => {
    const newVis: Record<string, boolean> = {};
    newSignals.forEach(s => { newVis[s.name] = true; });
    visibility.value = newVis;
}, { immediate: true });

// Цвета для сигналов (можно позже сделать настраиваемыми через тему)
const colorPalette = [
    [0, 0.8, 1, 1],
    [1, 0.5, 0, 1],
    [0.3, 1, 0.3, 1],
    [1, 0.3, 0.3, 1],
    [1, 0.8, 0, 1],
    [0.8, 0.4, 1, 1],
];
function getColor(name: string): string {
    const index = props.signals.findIndex(s => s.name === name) % colorPalette.length;
    const c = colorPalette[index];
    return `rgba(${c[0] * 255}, ${c[1] * 255}, ${c[2] * 255}, ${c[3]})`;
}

// Refs на canvas
const plotCanvas = ref<HTMLCanvasElement | null>(null);
const gridCanvas = ref<HTMLCanvasElement | null>(null);
const axisXCanvas = ref<HTMLCanvasElement | null>(null);
const axisYCanvas = ref<HTMLCanvasElement | null>(null);

let wglp: WebglPlot;
let dataLines: WebglLine[] = [];
let animationFrame: number;

let isPanning = false;
let panStartX = 0, panStartY = 0;
let panStartOffsetX = 0, panStartOffsetY = 0;

let resizeTimer: number;

onMounted(() => {
    if (!plotCanvas.value || !axisXCanvas.value || !axisYCanvas.value) return;

    const resizeCanvases = () => {
        const dpr = window.devicePixelRatio || 1;
        [plotCanvas, gridCanvas, axisXCanvas, axisYCanvas].forEach(canvasRef => {
            const canvas = canvasRef.value;
            if (canvas) {
                canvas.width = canvas.clientWidth * dpr;
                canvas.height = canvas.clientHeight * dpr;
            }
        });
    };
    resizeCanvases();

    wglp = new WebglPlot(plotCanvas.value);
    wglp.removeAllLines();

    wglp.gScaleX = 1;
    wglp.gOffsetX = 0;
    wglp.gScaleY = 0.1;
    wglp.gOffsetY = 0;

    plotCanvas.value.addEventListener('mousedown', onMouseDown);
    plotCanvas.value.addEventListener('mousemove', onMouseMove);
    plotCanvas.value.addEventListener('mouseup', onMouseUp);
    plotCanvas.value.addEventListener('wheel', onWheel, { passive: false });
    plotCanvas.value.addEventListener('dblclick', onDblClick);
    plotCanvas.value.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('resize', onResize);

    updateLines();

    const animate = () => {
        wglp.update();
        drawAxesAndGrid();
        animationFrame = requestAnimationFrame(animate);
    };
    animate();
});

function updateLines() {
    if (!wglp) return;

    wglp.removeAllLines();
    dataLines = [];

    props.signals.forEach((signal, index) => {
        if (visibility.value[signal.name] === false) return;

        const color = colorPalette[index % colorPalette.length];
        const rgba = new ColorRGBA(color[0], color[1], color[2], color[3]);
        const numPoints = signal.data.length;
        const line = new WebglLine(rgba, numPoints);
        line.lineSpaceX(-1, 2 / numPoints);

        for (let i = 0; i < numPoints; i++) {
            line.setY(i, signal.data[i]);
        }

        wglp.addDataLine(line);
        dataLines.push(line);
    });

    autoScaleY();
}

// Автомасштабирование по Y с динамическим padding
function autoScaleY() {
    if (props.signals.length === 0 || !wglp) return;

    let minY = Infinity, maxY = -Infinity;
    props.signals.forEach(signal => {
        if (visibility.value[signal.name] === false) return;
        const data = signal.data;
        for (let i = 0; i < data.length; i++) {
            if (data[i] < minY) minY = data[i];
            if (data[i] > maxY) maxY = data[i];
        }
    });

    if (minY === Infinity || maxY === -Infinity) return;

    // Новый padding: не менее 0.2 и 10% от размаха
    const padding = Math.max(0.2, (maxY - minY) * 0.1);
    const worldMin = minY - padding;
    const worldMax = maxY + padding;
    const range = worldMax - worldMin;

    wglp.gScaleY = 2 / range;
    wglp.gOffsetY = -worldMin * wglp.gScaleY - 1;
}

function toggleSignal(name: string) {
    visibility.value = {
        ...visibility.value,
        [name]: !visibility.value[name]
    };
}

watch([() => props.signals, visibility], () => {
    updateLines();
}, { deep: true });

// ========== Отрисовка осей и сетки (синхронизированы) ==========
function drawAxesAndGrid() {
    if (!wglp) return;

    const xCanvas = axisXCanvas.value;
    const yCanvas = axisYCanvas.value;
    const gCanvas = gridCanvas.value;

    if (!xCanvas || !yCanvas) return;

    const xCtx = xCanvas.getContext('2d');
    const yCtx = yCanvas.getContext('2d');
    if (!xCtx || !yCtx) return;

    xCtx.clearRect(0, 0, xCanvas.width, xCanvas.height);
    yCtx.clearRect(0, 0, yCanvas.width, yCanvas.height);

    // Видимый диапазон в мировых координатах
    const xMinWorld = (-1 - wglp.gOffsetX) / wglp.gScaleX;
    const xMaxWorld = (1 - wglp.gOffsetX) / wglp.gScaleX;
    const yMinWorld = (-1 - wglp.gOffsetY) / wglp.gScaleY;
    const yMaxWorld = (1 - wglp.gOffsetY) / wglp.gScaleY;

    const divisions = 8;
    const xTicks: number[] = [];
    const yTicks: number[] = [];

    for (let i = 0; i <= divisions; i++) {
        const t = i / divisions;
        xTicks.push(xMinWorld + t * (xMaxWorld - xMinWorld));
        yTicks.push(yMinWorld + t * (yMaxWorld - yMinWorld));
    }

    // Сетка (используем цвет текста с прозрачностью)
    if (props.grid && gCanvas) {
        const gCtx = gCanvas.getContext('2d');
        if (gCtx) {
            gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);
            // Извлекаем цвет текста из темы и добавляем прозрачность
            const textColor = theme.value.colors.text;
            // Преобразуем hex в rgba (упрощённо, если hex, то парсим, но для простоты используем полупрозрачный белый/чёрный)
            // В реальном проекте лучше использовать функцию для преобразования hex в rgba
            // Здесь для демонстрации будем использовать rgba с альфа-каналом 0.25 от цвета текста
            // Упростим: возьмём цвет текста и применим opacity через rgba, но нужно знать rgb компоненты.
            // Вместо этого можно добавить в тему отдельный цвет для сетки или использовать css-переменную.
            // Для примера установим сетку полупрозрачным серым, но чтобы соответствовать теме, можно использовать theme.colors.text с opacity.
            // Так как точное преобразование hex->rgb требует дополнительной логики, предлагаю использовать theme.colors.border с opacity.
            // Или добавим в тему поле grid. Пока используем border с opacity.
            const borderColor = theme.value.colors.border;
            gCtx.strokeStyle = borderColor + '40'; // добавляем прозрачность 25% (если hex, то append '40')
            gCtx.lineWidth = 1;

            for (const worldX of xTicks) {
                const xNorm = worldX * wglp.gScaleX + wglp.gOffsetX;
                const screenX = ((xNorm + 1) / 2) * gCanvas.width;
                gCtx.beginPath();
                gCtx.moveTo(screenX, 0);
                gCtx.lineTo(screenX, gCanvas.height);
                gCtx.stroke();
            }

            for (const worldY of yTicks) {
                const yNorm = worldY * wglp.gScaleY + wglp.gOffsetY;
                const screenY = (1 - (yNorm + 1) / 2) * gCanvas.height;
                gCtx.beginPath();
                gCtx.moveTo(0, screenY);
                gCtx.lineTo(gCanvas.width, screenY);
                gCtx.stroke();
            }
        }
    }

    // Ось X
    xCtx.font = '18px Courier New';
    xCtx.fillStyle = theme.value.colors.text;
    xCtx.strokeStyle = theme.value.colors.text;
    xCtx.lineWidth = 1;

    for (let i = 0; i <= divisions; i++) {
        const worldX = xTicks[i];
        const xNorm = worldX * wglp.gScaleX + wglp.gOffsetX;
        const screenX = ((xNorm + 1) / 2) * xCanvas.width;

        const index = ((worldX + 1) / 2) * (props.time.length - 1);
        const idx = Math.round(Math.max(0, Math.min(props.time.length - 1, index)));
        const timeValue = props.time[idx];

        xCtx.fillText(timeValue.toFixed(3) + ' с', screenX - 30, 20);
        xCtx.beginPath();
        xCtx.moveTo(screenX, 0);
        xCtx.lineTo(screenX, 10);
        xCtx.stroke();
    }

    // Ось Y
    yCtx.font = '18px Courier New';
    yCtx.fillStyle = theme.value.colors.text;
    yCtx.strokeStyle = theme.value.colors.text;
    yCtx.lineWidth = 1;

    for (let i = 0; i <= divisions; i++) {
        const worldY = yTicks[i];
        const yNorm = worldY * wglp.gScaleY + wglp.gOffsetY;
        const screenY = (1 - (yNorm + 1) / 2) * yCanvas.height;

        yCtx.fillText(worldY.toFixed(2) + ' В', 5, screenY);
        yCtx.beginPath();
        yCtx.moveTo(yCanvas.width - 10, screenY);
        yCtx.lineTo(yCanvas.width, screenY);
        yCtx.stroke();
    }
}

// ========== Обработчики взаимодействия ==========
function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();

    const normCoords = getNormalizedCoordinates(e);
    if (!normCoords) return;

    isPanning = true;
    panStartX = normCoords.x;
    panStartY = normCoords.y;
    panStartOffsetX = wglp.gOffsetX;
    panStartOffsetY = wglp.gOffsetY;

    plotCanvas.value!.style.cursor = 'grabbing';
}

function onMouseMove(e: MouseEvent) {
    if (!isPanning) return;
    e.preventDefault();

    const normCoords = getNormalizedCoordinates(e);
    if (!normCoords) return;

    wglp.gOffsetX = panStartOffsetX + (normCoords.x - panStartX);
    wglp.gOffsetY = panStartOffsetY + (normCoords.y - panStartY);
}

function onMouseUp(e: MouseEvent) {
    if (e.button !== 0) return;
    isPanning = false;
    plotCanvas.value!.style.cursor = 'default';
}

function onWheel(e: WheelEvent) {
    e.preventDefault();

    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    const normCoords = getNormalizedCoordinates(e);
    if (!normCoords) return;

    const xNorm = normCoords.x;
    const yNorm = normCoords.y;

    if (e.shiftKey) {
        const worldY = (yNorm - wglp.gOffsetY) / wglp.gScaleY;
        wglp.gScaleY *= factor;
        wglp.gScaleY = Math.max(1e-12, wglp.gScaleY);
        wglp.gOffsetY = yNorm - worldY * wglp.gScaleY;
    } else {
        const worldX = (xNorm - wglp.gOffsetX) / wglp.gScaleX;
        wglp.gScaleX *= factor;
        wglp.gScaleX = Math.max(1e-12, wglp.gScaleX);
        wglp.gOffsetX = xNorm - worldX * wglp.gScaleX;
    }
}

function onDblClick(e: MouseEvent) {
    e.preventDefault();
    wglp.gScaleX = 1;
    wglp.gOffsetX = 0;
    autoScaleY();
}

function getNormalizedCoordinates(e: MouseEvent | WheelEvent): { x: number; y: number } | null {
    if (!plotCanvas.value) return null;
    const rect = plotCanvas.value.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const xNorm = (2 * mouseX) / plotCanvas.value.width - 1;
    const yNorm = 1 - (2 * mouseY) / plotCanvas.value.height;
    return { x: xNorm, y: yNorm };
}

function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
        if (plotCanvas.value && axisXCanvas.value && axisYCanvas.value) {
            const dpr = window.devicePixelRatio || 1;
            plotCanvas.value.width = plotCanvas.value.clientWidth * dpr;
            plotCanvas.value.height = plotCanvas.value.clientHeight * dpr;
            if (gridCanvas.value) {
                gridCanvas.value.width = gridCanvas.value.clientWidth * dpr;
                gridCanvas.value.height = gridCanvas.value.clientHeight * dpr;
            }
            axisXCanvas.value.width = axisXCanvas.value.clientWidth * dpr;
            axisXCanvas.value.height = axisXCanvas.value.clientHeight * dpr;
            axisYCanvas.value.width = axisYCanvas.value.clientWidth * dpr - 30;
            axisYCanvas.value.height = axisYCanvas.value.clientHeight * dpr;
        }
    }, 100);
}

onUnmounted(() => {
    if (plotCanvas.value) {
        plotCanvas.value.removeEventListener('mousedown', onMouseDown);
        plotCanvas.value.removeEventListener('mousemove', onMouseMove);
        plotCanvas.value.removeEventListener('mouseup', onMouseUp);
        plotCanvas.value.removeEventListener('wheel', onWheel);
        plotCanvas.value.removeEventListener('dblclick', onDblClick);
    }
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(animationFrame);
});
</script>

<style scoped>
div {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

canvas {
    display: block;
}
</style>
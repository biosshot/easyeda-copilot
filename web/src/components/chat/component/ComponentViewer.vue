<!-- ComponentViewer.vue -->
<template>
    <div class="component-viewer">
        <div v-if="!result" class="empty-message">
            Not found.
        </div>

        <template v-else>
            <div class="result-item">
                <div v-for="(result, idx) in props.result" :key="idx">
                    <!-- Отображаем best_component, если он есть -->
                    <div v-if="result.best_component" class="best-component">
                        <h3>Best component</h3>
                        <ComponentCard :component="result.best_component" />
                    </div>

                    <!-- Отображаем список components, если onlyBest = false и они есть -->
                    <div v-if="result.components && result.components.length > 0" class="other-components">
                        <h3>Other suitable components ({{ result.components.length }})</h3>
                        <div class="components-grid">
                            <ComponentCard v-for="(comp, cIdx) in result.components" :key="cIdx" :component="comp"
                                class="component-card" />
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { onMounted, watch, watchEffect } from 'vue';
import type { Component } from '../../../types/component';
import ComponentCard from './ComponentCard.vue' // Предполагается, что ты создашь этот компонент
import { InlineButton } from '../../../types/inline-button';

const props = defineProps<{
    result: {
        components: Component[],
        best_component?: Component
    }[]
}>();

const emit = defineEmits<{ 'inline-buttons': [InlineButton[]] }>();

const placeComponent = async (part_uuid: string) => {
    try {
        await eda.sch_PrimitiveComponent.placeComponentWithMouse({
            libraryUuid: 'lcsc',
            uuid: part_uuid
        })
    } catch (error) {
        console.error('Error placing component:', error)
    }
}

watchEffect(() => {
    const inlineButtons = [];

    for (const result of props.result) {
        if (result.best_component) {
            inlineButtons.push(
                {
                    icon: 'Play',
                    text: result.best_component.name,
                    handler: () => placeComponent(result.best_component?.part_uuid ?? '')
                }
            )
        }
        else {
            result.components.slice(0, 2).map(comp => {
                inlineButtons.push(
                    {
                        icon: 'Play',
                        text: comp.name,
                        handler: () => placeComponent(comp?.part_uuid ?? '')
                    }
                )
            })
        }
    }

    emit('inline-buttons', inlineButtons);
})


</script>

<style scoped>
.empty-message {
    text-align: center;
    padding: 20px;
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 0.95em;
}

.result-item {
    margin-bottom: 24px;
}

.best-component h3,
.other-components h3 {
    font-size: 1.1em;
    margin-top: 0;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
}

.other-components h3 {
    color: var(--color-secondary);
}

.components-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
}
</style>
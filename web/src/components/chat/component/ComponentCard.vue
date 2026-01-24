<!-- ComponentCard.vue -->
<template>
  <div class="component-card">
    <div class="header">
      <h4>{{ component.name }}</h4>
      <div v-if="component.datasheet" class="datasheet-link">
        <a :href="component.datasheet" target="_blank" rel="noopener">datasheet</a>
      </div>
    </div>

    <p><strong>Manufacturer:</strong> {{ component.manufacturer }}</p>
    <p><strong>Price:</strong> {{ component.price }} $</p>

    <p>{{ component.description }}</p>

    <IconButton v-if="isEasyEdaActive" @click="placeComponent" class="place-button" icon="Replace">Place</IconButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isEasyEda } from '../../../eda/utils'
import type { Component } from '../../../types/component'
import IconButton from '../../shared/IconButton.vue'

const props = defineProps<{ component: Component }>();

const isEasyEdaActive = computed(() => isEasyEda())

const placeComponent = async () => {
  try {
    await eda.sch_PrimitiveComponent.placeComponentWithMouse({
      libraryUuid: 'lcsc',
      uuid: props.component.part_uuid
    })
  } catch (error) {
    console.error('Error placing component:', error)
  }
}
</script>

<style scoped>
.header {
  display: flex;
  gap: 0.5rem;
}

.header h4 {
  max-width: 80%;
}

.header .datasheet-link {
  margin-left: auto;
}

.component-card {
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  color: var(--color-text);
  transition: border-color 0.2s ease;
}

.component-card:hover {
  border-color: var(--color-primary);
}

.component-card h4 {
  margin-top: 0;
  margin-bottom: 8px;
  color: var(--color-text);
  font-weight: 600;
}

.component-card p {
  margin: 4px 0;
  line-height: 1.4;
}

.datasheet-link a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.datasheet-link a:hover {
  text-decoration: underline;
}

.place-button {
  margin-top: 12px;
  width: 100%;
  padding: 4px;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.place-button:hover {
  background-color: var(--color-primary-light);
}

.place-button:active {
  background-color: var(--color-primary-dark);
}
</style>
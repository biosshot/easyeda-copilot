<!-- ComponentCard.vue -->
<template>
  <div class="component-card">
    <ImageUrlView class="component-image" :result="{ image_url: imageUrl }" :disable-error="true">
    </ImageUrlView>

    <div class="container">
      <div class="header">
        <h4>{{ component.name }}</h4>
        <div class="header-actions">
          <div v-if="component.datasheet" class="datasheet-link">
            <a :href="component.datasheet" target="_blank" rel="noopener">datasheet</a>
          </div>
          <IconButton @click="onClick" variant="ghost" class="place-button" icon="Replace">
            Place</IconButton>
        </div>
      </div>

      <p><strong>Footprint:</strong> {{ component.footprintName ?? 'Unknown' }}</p>
      <p><strong>Brand:</strong> {{ component.manufacturer }}</p>
      <p><strong>Price:</strong> {{ component.price }} $</p>
      <p><strong>Desc:</strong> {{ component.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import "@copilot/shared/types/eda";
import { isEasyEda, showToastMessage } from '../../../eda/utils'
import { Component } from '@copilot/shared/types/component'
import IconButton from '../../shared/IconButton.vue'
import { placeComponent } from './place';
import ImageUrlView from '../img/ImageUrlView.vue';
import { ref } from 'vue';

const props = defineProps<{ component: Component }>();

const imageUrl = ref<string | undefined>();

if (isEasyEda()) {
  eda.lib_Device.get(props.component.part_uuid).then((device) => {
    if (device?.association.images?.length) {
      imageUrl.value = device?.association.images[0];
    }
  })
}
else {
  imageUrl.value = 'https://alimg.szlcsc.com/upload/public/product/middle/20230129/E8FFCCD5B90EC603DB3AC2C2407F319F.jpg'
}

const onClick = async () => {
  try {
    await placeComponent(props.component.part_uuid);
  } catch (error) {
    showToastMessage('Error place component: ' + (error as Error).message, 'error');
  }
}
</script>

<style scoped>
.header {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
}

.header h4 {
  margin-right: auto;
  padding-right: 10px;
  min-width: 0;
  max-width: none;
  margin-bottom: 0;
  overflow-wrap: break-word;
  word-break: normal;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
}

.header .datasheet-link {
  flex-shrink: 0;
}

.component-card {
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  color: var(--color-text);
  text-align: left;
  transition: border-color 0.2s ease;
  overflow: hidden;
}

.component-image {
  float: left;
  max-width: 120px;
  margin-right: 16px;
  margin-bottom: 8px;
  border-radius: 6px;
}

.container {
  min-width: 0;
  text-align: left;
}

.component-card h4 {
  margin-top: 0;
  color: var(--color-text);
  font-weight: 600;
}

.component-card p {
  margin: 4px 0;
  line-height: 1.4;
}

.component-card p strong {
  display: inline-block;
  min-width: 86px;
}

.datasheet-link a {
  padding-top: 3px;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.datasheet-link a:hover {
  text-decoration: underline;
}

.place-button {
  margin-left: 0;
  flex-shrink: 0;
  width: fit-content;
  border: 1px solid var(--color-border);
  padding: 0px 10px;
}
</style>
<template>
  <div class="generate-view">
    <!-- Шаг 1: Ввод и выбор опций -->
    <div v-if="!showGeneration" class="input-section">
      <div class="section">
        <h2>Circuit Prompt</h2>
        <textarea v-model="prompt" placeholder="Describe the circuit you want to generate... (min 16 characters)"
          rows="4"></textarea>
        <p v-if="prompt.length < 16" class="hint">
          {{ 16 - prompt.length }} characters left to enable generation
        </p>
      </div>

      <div class="section">
        <h2>Generation Options</h2>
        <div class="options-grid">
          <button v-for="opt in options" :key="opt.value"
            :class="['option-btn', { active: selectedOptions.includes(opt.value) }]" @click="toggleOption(opt.value)">
            <Icon :name="getIcon(opt.value)" size="20" />
            {{ opt.label }}
          </button>
        </div>
      </div>

      <button :disabled="!canGenerate" class="generate-btn" @click="startGeneration">
        Generate Circuit
      </button>
    </div>

    <!-- Шаг 2: Результат генерации -->
    <div v-else class="result-section">
      <button class="back-btn" @click="goBack">
        ← Back to prompt
      </button>

      <div class="result-panel">
        <div class="tabs">
          <button v-for="tab in tabs" :key="tab.value" :class="['tab', { active: activeTab === tab.value }]"
            @click="activeTab = tab.value">
            {{ tab.label }}
          </button>
        </div>

        <div v-if="loading" class="content loading">
          <div class="spinner"></div>
          <p>Generating circuit...</p>
        </div>

        <div v-else class="content" v-html="currentContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '../stores/appStore';
import Icon from '@/components/Icon.vue';
import { apiUrl, authorization, fetchWithTask } from '../fetchWithTask.ts';

// ======================
// Состояния (локальные, не из store)
// ======================
const showGeneration = ref(false);
const activeTab = ref('chat');
const loading = ref(false);
const prompt = ref('');
const selectedOptions = ref(['block-diagram']); // по умолчанию выбираем опцию блок-схемы

// Используем store ТОЛЬКО для чтения/записи через computed
const store = useAppStore();

// const prompt = computed({
//   get: () => store.prompt,
//   set: (value) => store.setPrompt(value)
// });

// const selectedOptions = computed({
//   get: () => store.selectedOptions ? store.selectedOptions : [], // совместимость с моком
//   set: (value) => {
//     // храним только первый выбранный (если нужно несколько — измените логику)
//     store.setSelectedOption(value);
//   }
// });

// ======================
// Константы
// ======================
const options = [
  // { value: 'functional', label: 'Generate functional circuit', icon: 'Settings' },
  // { value: 'diagnostic', label: 'Generate diagnostic algorithm', icon: 'AudioWaveform' },
];

const tabs = [
  { value: 'components', label: 'Components' },
  { value: 'functional', label: 'Functional' },
  { value: 'diagnostic', label: 'Diagnostic' },
];

// ======================
// Вычисляемые свойства
// ======================
const canGenerate = computed(() => prompt.value.trim().length >= 16 && selectedOptions.value.length > 0);

const generatedContent = ref({
  components: '',
  functional: '',
  diagnostic: '',
});

const currentContent = computed(() => {
  if (loading.value) return '';

  const contentMap = {
    components: generatedContent.value.components || '<p>Components not yet loaded</p>',
    functional: generatedContent.value.functional || '<p>Functional schematic not available</p>',
    diagnostic: generatedContent.value.diagnostic || '<p>Diagnostic algorithm not available</p>',
  };

  return contentMap[activeTab.value] || '<p>Content unavailable</p>';
});

// ======================
// Методы
// ======================
function getIcon(optionValue) {
  return options.find(opt => opt.value === optionValue)?.icon || 'Zap';
}

function toggleOption(option) {
  if (selectedOptions.value.includes(option)) {
    selectedOptions.value = selectedOptions.value.filter(o => o !== option);
  } else {
    selectedOptions.value = [...selectedOptions.value, option]; // только одно значение (как в моке)
  }
}

async function startGeneration() {
  showGeneration.value = true;
  loading.value = true;
  activeTab.value = 'components';
  generatedContent.value = { components: '', functional: '', diagnostic: '' };

  try {

    const body = {
      prompt: prompt.value.trim(),
      options: {},
      llmSettings: {
        provider: settingsStore.getApiProvider,
        apiKey: settingsStore.getApiKey,
      }
    };

    if (!body.llmSettings.apiKey) {
      throw new Error('API Key is not set. Please set it in Settings.');
    }

    if (!body.llmSettings.provider) {
      throw new Error('API Provider is not set. Please set it in Settings.');
    }

    const response = await fetchWithTask({
      url: `${apiUrl}/make-circuit`,
      body: JSON.stringify(body),
      headers: {
        'Authorization': authorization,
      }
    });

    const circuit = response.circuit;

    // ——— Компоненты ———
    generatedContent.value.components = circuit.components
      ?.map(comp => `<p><strong>${comp.designator}:</strong> ${comp.value}</p>`)
      .join('\n') || '<p>No components generated</p>';

    // ——— Функциональная схема ———
    let functionalHtml = '';

    if (response.blockDiagram) {
      functionalHtml += `<img src="${apiUrl}/${response.blockDiagram}" style="width: 98%; margin: auto; display: block; margin-bottom: 24px;">`;
    }

    if (circuit.blocks) {
      functionalHtml += circuit.blocks
        .map(block => `
          <div class="content-item">
            <h3>Block: ${block.name}</h3>
            <p><strong>Description:</strong> ${block.description || 'N/A'}</p>
          </div>
        `)
        .join('');
    }

    generatedContent.value.functional = functionalHtml || '<p>No functional schematic</p>';
    generatedContent.value.diagnostic = '<p>Diagnostic algorithm will be available soon.</p>';

    // ——— Опционально: построить схему в EasyEDA ———
    if (typeof window.eda !== 'undefined') {
      await eda.assembleCircuit(circuit);
    }
  } catch (error) {
    console.error('Generation error:', error);
    const errorMsg = error.message || 'Unknown error';
    generatedContent.value.components = `<p style="color: var(--color-error);">Error: ${errorMsg}</p>`;
    generatedContent.value.functional = `<p style="color: var(--color-error);">Generation failed.</p>`;
    // Вкладка "components" уже активна
  } finally {
    loading.value = false;
  }
}

function goBack() {
  showGeneration.value = false;
  // prompt и selectedOptions управляются через store — не сбрасываем здесь
}


</script>

<style scoped>
.generate-view {
  padding: 1.5rem;
  background-color: var(--color-background);
  color: var(--color-text);
}

.input-section,
.result-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  margin-bottom: 0;
}

.section h2 {
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
}

textarea {
  width: calc(100% - 1.5rem);
  padding: 0.75rem;
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  resize: vertical;
  font-family: inherit;
}

.hint {
  font-size: 0.85rem;
  color: var(--color-warning);
  margin-top: 0.25rem;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-weight: 500;
}

.option-btn:hover {
  background-color: var(--color-surface-hover);
}

.option-btn.active {
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  border-color: var(--color-primary);
}

.generate-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.generate-btn:disabled {
  background-color: var(--color-surface-hover);
  cursor: not-allowed;
}

.back-btn {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  background-color: var(--color-surface-hover);
  color: var(--color-text);
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.result-panel {
  background-color: var(--color-background-secondary);
  border-radius: 0.5rem;
  overflow: hidden;
  flex: 1;
}

.tabs {
  display: flex;
  background-color: var(--color-surface-hover);
}

.tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.tab.active {
  background-color: var(--color-background);
  color: var(--color-text);
  border-bottom: 2px solid var(--color-primary);
}

.content {
  padding: 1.5rem;
  min-height: 200px;
  background-color: var(--color-background-secondary);
}

.content.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #30363d;
  border-top: 3px solid #10a37f;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>

<style>
.content-item {
  margin-bottom: 24px;
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid #10a37f;
}
</style>
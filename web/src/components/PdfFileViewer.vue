<template>
    <div class="pdf-file-viewer">
        <div class="pdf-header">
            <div class="left">
                <strong class="name">{{ filename }}</strong>
            </div>
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <div v-else-if="finalSrc" class="preview">
            <embed :src="finalSrc" type="application/pdf" width="350px" height="350px" />
        </div>

        <div v-else-if="url" class="preview">
            <!-- fallback: show original URL (may trigger CORS error in console) -->
            <embed :src="url" type="application/pdf" width="350px" height="350px" />
        </div>

        <div v-else class="no-url">Файл не найден</div>
    </div>
</template>

<script setup>
import { apiUrl, authorization, fetchEda } from '../fetchWithTask.ts'
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
    result: {
        type: [String, Object],
        required: true
    }
})

// Поддерживаем несколько форматов: строка (url) или объект { url, name }
const url = computed(() => {
    if (!props.result) return ''
    if (typeof props.result === 'string') return apiUrl + props.result
    return apiUrl + (props.result.url || props.result.file || '');
})

const filename = computed(() => {
    if (props.result && typeof props.result === 'object' && props.result.name) return props.result.name
    try {
        const u = new URL(url.value)
        return u.pathname.split('/').pop() || 'file.pdf'
    } catch (e) {
        return 'file.pdf'
    }
})

const finalSrc = ref('')
const error = ref('')

async function loadWithNoCors() {
    const src = url.value;

    // Очистим предыдущий object URL
    if (finalSrc.value) {
        URL.revokeObjectURL(finalSrc.value)
        finalSrc.value = ''
    }

    if (!src) return

    if (!src) return

    try {
        // Попытка загрузить ресурс (fetchEda инкапсулирует поведение запросов)
        const resp = await fetchEda(src, {
            headers: {
                "Authorization": authorization
            }
        })
        const blob = await resp.blob()

        // Простая проверка MIME. Если MIME не явно application/pdf,
        // дополнительно проверим сигнатуру файла "%PDF-" в первых байтах.
        let isPdf = false
        if (blob && blob.type === 'application/pdf') {
            isPdf = true
        } else if (blob) {
            try {
                const headerBuf = await blob.slice(0, 5).arrayBuffer()
                const headerArr = new Uint8Array(headerBuf)
                const sig = String.fromCharCode(...headerArr)
                if (sig === '%PDF-') isPdf = true
            } catch (inner) {
                // Если чтение не удалось, оставим isPdf=false
            }
        }

        if (!isPdf) {
            error.value = 'The downloaded file is not a PDF or is corrupted.'
            finalSrc.value = ''
            return finalSrc.value
        }

        // Создаём object URL только если это PDF
        finalSrc.value = URL.createObjectURL(blob)
        error.value = ''
    } catch (e) {
        // Ошибка при загрузке
        error.value = 'Failed to upload file.'
        finalSrc.value = '';
    }

    return finalSrc.value;
}

// Следим за изменением URL и перезагружаем PDF
watch(url, () => {
    loadWithNoCors()
}, { immediate: true })

onBeforeUnmount(() => {
    if (finalSrc.value) {
        URL.revokeObjectURL(finalSrc.value)
        finalSrc.value = ''
    }
})
</script>

<style scoped>
.error {
    color: #fca5a5;
    background: rgba(255, 0, 0, 0.03);
    padding: 0.5rem;
    border-radius: 6px;
}
</style>

<style scoped>
.pdf-file-viewer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.pdf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
}

.pdf-header .name {
    color: var(--color-text-secondary);
}

.download {
    background: var(--color-secondary);
    color: var(--color-text-on-primary);
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.9rem;
}

.preview {
    min-height: 200px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    overflow: hidden;
}

.preview iframe {
    width: 100%;
    height: 480px;
    border: none;
}

.no-url {
    color: var(--color-text-tertiary);
}
</style>

import { ref } from 'vue'
import { fetchWithTask } from '../api'
import { showToastMessage } from '../eda/utils'
import { formatError } from '../utils/error'

export type DigitizedBlock = {
    name?: string
    description?: string
    x: number
    y: number
    next_block_names?: string[]
}

export function useBlockDiagramDigitization() {
    const isDigitizing = ref(false)
    const progressText = ref('')
    let controller: AbortController | null = null

    const readFileAsDataURL = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(String(e.target?.result))
            reader.onerror = reject
            reader.readAsDataURL(file)
        })

    const startDigitization = async (file: File): Promise<{ blocks: DigitizedBlock[] } | null> => {
        const base64Image = await readFileAsDataURL(file)

        // cancel previous if still running
        if (controller) {
            controller.abort()
        }
        controller = new AbortController()

        isDigitizing.value = true
        progressText.value = 'Connecting…'

        try {
            const result = await fetchWithTask({
                url: '/v1/block-diagram-digitization',
                body: { image: { data: base64Image } },
                fetchOptions: { signal: controller.signal },
                pollIntervalMs: 2000,
                onProgress: (s: string) => {
                    progressText.value = s || 'Processing…'
                },
            })

            if (result && Array.isArray(result.blocks)) {
                return { blocks: result.blocks as DigitizedBlock[] }
            } else {
                console.error('Digitization result malformed', result)
                return null
            }
        } catch (err) {
            showToastMessage(formatError(err), 'error')
            return null
        } finally {
            isDigitizing.value = false
            progressText.value = ''
            controller = null
        }
    }

    const cancelDigitization = () => {
        if (controller) {
            controller.abort()
        }
    }

    return { isDigitizing, progressText, startDigitization, cancelDigitization }
}

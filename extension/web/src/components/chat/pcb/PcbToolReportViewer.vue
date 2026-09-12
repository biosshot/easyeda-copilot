<template>
    <div class="pcb-report">
        <div class="header">
            <div>
                <h3>PCB layout report</h3>
                <p class="subtitle">{{ statusText }}</p>
            </div>
            <span class="status-pill" :class="report.status">{{ report.status }}</span>
        </div>

        <div class="summary-grid">
            <div class="summary-card" :class="{ ok: report.placement.ok, bad: !report.placement.ok }">
                <span class="summary-title">Placement</span>
                <span class="summary-value">{{ report.placement.ok ? 'OK' : `${placementIssueCount} issues` }}</span>
            </div>
            <div class="summary-card" :class="{ ok: report.routing.ok, bad: !report.routing.ok }">
                <span class="summary-title">Routing</span>
                <span class="summary-value">{{ report.routing.ok ? 'OK' : `${routingIssueCount} issues` }}</span>
            </div>
        </div>

        <Collapsible v-if="report.placement.overlaps.length" class="section">
            <template #title>
                <span class="collapsible-title error">{{ report.placement.overlaps.length }} Overlaps</span>
            </template>
            <IssueList :items="report.placement.overlaps" />
        </Collapsible>

        <Collapsible v-if="report.placement.outsideBoard.length" class="section">
            <template #title>
                <span class="collapsible-title error">{{ report.placement.outsideBoard.length }} Outside board</span>
            </template>
            <IssueList :items="report.placement.outsideBoard" />
        </Collapsible>

        <Collapsible v-if="report.placement.blockViolations.length" class="section">
            <template #title>
                <span class="collapsible-title warning">{{ report.placement.blockViolations.length }} Block violations</span>
            </template>
            <IssueList :items="report.placement.blockViolations" />
        </Collapsible>

        <Collapsible v-if="report.routing.unroutedNets.length" class="section">
            <template #title>
                <span class="collapsible-title error">{{ report.routing.unroutedNets.length }} Unrouted nets</span>
            </template>
            <div class="chips">
                <span v-for="net in report.routing.unroutedNets" :key="net" class="chip error">{{ net }}</span>
            </div>
        </Collapsible>

        <Collapsible v-if="report.routing.partiallyRoutedNets.length" class="section">
            <template #title>
                <span class="collapsible-title warning">{{ report.routing.partiallyRoutedNets.length }} Partially routed nets</span>
            </template>
            <div class="chips">
                <span v-for="net in report.routing.partiallyRoutedNets" :key="net" class="chip warning">{{ net }}</span>
            </div>
        </Collapsible>

        <Collapsible v-if="report.routing.errors.length" class="section">
            <template #title>
                <span class="collapsible-title error">{{ report.routing.errors.length }} Routing errors</span>
            </template>
            <IssueList :items="report.routing.errors" />
        </Collapsible>

        <Collapsible v-if="report.routing.warnings.length" class="section">
            <template #title>
                <span class="collapsible-title warning">{{ report.routing.warnings.length }} Routing warnings</span>
            </template>
            <IssueList :items="report.routing.warnings" />
        </Collapsible>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, PropType } from 'vue'
import { PcbToolReport } from '@copilot/shared/types/pcb/tool-report'
import Collapsible from '../../shared/Collapsible.vue'

const props = defineProps<{ result: PcbToolReport }>()

const report = computed(() => ({
    status: props.result?.status ?? 'warning',
    placement: {
        ok: Boolean(props.result?.placement?.ok),
        overlaps: props.result?.placement?.overlaps ?? [],
        outsideBoard: props.result?.placement?.outsideBoard ?? [],
        blockViolations: props.result?.placement?.blockViolations ?? [],
    },
    routing: {
        ok: Boolean(props.result?.routing?.ok),
        unroutedNets: props.result?.routing?.unroutedNets ?? [],
        partiallyRoutedNets: props.result?.routing?.partiallyRoutedNets ?? [],
        errors: props.result?.routing?.errors ?? [],
        warnings: props.result?.routing?.warnings ?? [],
    },
}))

const placementIssueCount = computed(() =>
    report.value.placement.overlaps.length +
    report.value.placement.outsideBoard.length +
    report.value.placement.blockViolations.length
)

const routingIssueCount = computed(() =>
    report.value.routing.unroutedNets.length +
    report.value.routing.partiallyRoutedNets.length +
    report.value.routing.errors.length +
    report.value.routing.warnings.length
)

const statusText = computed(() => {
    if (report.value.status === 'ok') return 'Placement and routing passed'
    if (report.value.status === 'error') return 'PCB layout has blocking issues'
    return 'PCB layout completed with warnings'
})

const IssueList = defineComponent({
    props: {
        items: {
            type: Array as PropType<string[]>,
            required: true,
        },
    },
    setup(componentProps) {
        return () => h('ul', { class: 'issue-list' },
            componentProps.items.map((item, index) => h('li', { key: index }, item))
        )
    },
})
</script>

<style scoped>
.pcb-report {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.75rem;
}

h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.05rem;
}

.subtitle {
    margin: 0.25rem 0 0;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
}

.status-pill,
.chip {
    border-radius: 0.25rem;
    padding: 0.15rem 0.45rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.status-pill.ok,
.summary-card.ok {
    color: #2cbe4e;
}

.status-pill.warning,
.chip.warning,
.summary-card.bad {
    color: #d29922;
}

.status-pill.error,
.chip.error {
    color: #cb2431;
}

.status-pill {
    background: var(--color-background);
    border: 1px solid var(--color-border);
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.5rem;
}

.summary-card {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    padding: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.summary-title {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

.summary-value {
    font-weight: 700;
    font-size: 0.95rem;
}

.section {
    margin-top: 0.1rem;
}

.collapsible-title {
    color: var(--color-text-primary);
    font-size: 0.85rem;
    font-weight: 600;
}

.collapsible-title.warning {
    color: #d29922;
}

.collapsible-title.error {
    color: #cb2431;
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.chip {
    background: var(--color-background);
    border: 1px solid var(--color-border);
    text-transform: none;
}

:deep(.issue-list) {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--color-text-secondary);
}

:deep(.issue-list li) {
    margin: 0.2rem 0;
}
</style>

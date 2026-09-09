import type { LayoutOptions } from 'elkjs';

export type SchematicLayoutProfile = {
    name: string;
    options: LayoutOptions;
};

export const BASELINE_LAYOUT_PROFILE: SchematicLayoutProfile = {
    name: 'baseline',
    options: {
        'elk.algorithm': 'org.eclipse.elk.layered',
        'org.eclipse.elk.layered.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': '30',
        'elk.portConstraints': 'FIXED_POS',
        'elk.layered.spacing.layerSpacing': '20',
        'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
        'elk.layered.spacing.nodeNodeBetweenLayers': '20',
    },
};

export const LOCAL_LAYOUT_PROFILES: SchematicLayoutProfile[] = [
    {
        name: 'balanced',
        options: {
            ...BASELINE_LAYOUT_PROFILE.options,
            'elk.spacing.nodeNode': '25',
            'elk.layered.spacing.layerSpacing': '20',
            'elk.layered.spacing.edgeEdgeBetweenLayers': '15',
            'elk.layered.spacing.nodeNodeBetweenLayers': '20',
            'org.eclipse.elk.spacing.componentComponent': '20',
            'org.eclipse.elk.layered.compaction.connectedComponents': 'true',
        },
    },
    {
        name: 'compact',
        options: {
            ...BASELINE_LAYOUT_PROFILE.options,
            'elk.spacing.nodeNode': '20',
            'elk.layered.spacing.layerSpacing': '15',
            'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
            'elk.layered.spacing.nodeNodeBetweenLayers': '15',
            'org.eclipse.elk.spacing.componentComponent': '15',
            'org.eclipse.elk.layered.compaction.connectedComponents': 'true',
        },
    },
];

const wrappedOptions = {
    ...LOCAL_LAYOUT_PROFILES[0].options,
    'org.eclipse.elk.layered.wrapping.additionalEdgeSpacing': '15',
    'org.eclipse.elk.layered.wrapping.correctionFactor': '1',
};

export const WRAPPED_LAYOUT_PROFILE: SchematicLayoutProfile = {
    name: 'wrapped',
    options: {
        ...wrappedOptions,
        'org.eclipse.elk.aspectRatio': '2.2',
        'org.eclipse.elk.layered.wrapping.strategy': 'MULTI_EDGE',
        'org.eclipse.elk.layered.wrapping.cutting.strategy': 'ARD',
        'org.eclipse.elk.layered.wrapping.validify.strategy': 'LOOK_BACK',
    },
};

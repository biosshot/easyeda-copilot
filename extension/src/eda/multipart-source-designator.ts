import type { SourceRecord } from './source-document';

export interface MultipartSourceUnit {
    designator: string;
    primitiveId?: string;
    partUuid?: string | null;
    subPartName?: string;
}

export interface MultipartSourceDesignatorResult {
    changedAttributes: number;
    normalizedComponents: number;
}

const multipartBaseDesignator = (designator: string) => {
    const match = designator.trim().match(/^(.*)\.(\d+)$/);
    return match?.[1];
};

function designatorAttribute(records: SourceRecord[], parentId: string) {
    return records.find(record => (
        record.outer.type === 'ATTR' &&
        record.inner?.parentId === parentId &&
        record.inner?.key === 'Designator'
    ));
}

/** Keep all requested sections on one reference without overriding EasyEDA's identities. */
export function normalizeMultipartSourceDesignators(
    records: SourceRecord[],
    units: MultipartSourceUnit[],
): MultipartSourceDesignatorResult {
    const groups = new Map<string, MultipartSourceUnit[]>();

    for (const unit of units) {
        const baseDesignator = multipartBaseDesignator(unit.designator);
        if (!baseDesignator || !unit.subPartName || !unit.primitiveId) continue;
        const group = groups.get(baseDesignator) ?? [];
        group.push(unit);
        groups.set(baseDesignator, group);
    }

    let changedAttributes = 0;
    let normalizedComponents = 0;

    for (const [baseDesignator, group] of groups) {
        if (group.length < 2) continue;

        const partUuids = new Set(group.map(unit => unit.partUuid).filter(Boolean));
        if (partUuids.size > 1) {
            throw new Error(`Multi-part ${baseDesignator} contains different part UUIDs`);
        }

        for (const unit of group) {
            const attribute = designatorAttribute(records, unit.primitiveId!);
            if (!attribute?.inner) {
                throw new Error(`Cannot normalize multi-part ${unit.designator}: Designator is missing`);
            }
            if (attribute.inner.value !== baseDesignator) {
                attribute.inner.value = baseDesignator;
                changedAttributes++;
            }
        }
        normalizedComponents++;
    }

    return { changedAttributes, normalizedComponents };
}

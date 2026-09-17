/** Compact, read-only context for the current schematic page. */
export interface SchematicGroups {
    maybe_blocks: string[];
    wires: {
        net: string | null;
        pins: string;
    }[];
}

export type Circuit = {
    metadata: {
        description: string;
        project_name: string;
    };
    blocks: {
        name: string;
        description: string;
        next_block_names: string[];
    }[];
    components: {
        pins: {
            name: string;
            pin_number: number;
            signal_name: string;
        }[];
        value: string;
        part_uuid: string | null;
        designator: string;
        block_name: string;
        search_query: string;
    }[];
};

export type CircuitAgentResult = {
    type: 'circuit_agent_result';
    result: {
        circuit: Circuit;
        blockDiagram: string; // ссылка на pdf файл структурной схемы
    };
};

export type ParsedMessage =
    | { type: 'component_search_result'; result: any }
    | { type: 'circuit_explain_result'; result: any }
    | { type: 'pdf_file'; result: any }
    | CircuitAgentResult
    | string;

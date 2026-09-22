type Policy = { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean; managed?: boolean };
const read: Policy = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const write: Policy = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const managed: Policy = { ...write, managed: true };

/** Explicit inventory: adding a tool requires choosing its effect and lifecycle. */
export const TOOL_POLICIES: Record<string, Policy> = {
    component_search: { ...read, openWorldHint: true },
    get_all_projects: read,
    get_current_project_info: read,
    get_schematic: read,
    get_schematic_groups: read,
    get_pcb_component_sizes: read,
    get_pcb_stack_layers: read,
    get_pcb_drc_rules: read,
    check_pcb_drc: read,
    preview_pcb: read,
    inspect_net: read,
    inspect_component: read,
    get_current_pcb: read,
    list_checkpoints: read,
    list_easyeda_instances: read,
    list_operations: read,
    wait_operation: read,
    make_pcb_layout: { ...read, idempotentHint: false },
    run_pcb_router_dsl: write, // Already managed.
    cancel_operation: { ...write, destructiveHint: false, idempotentHint: true },
    apply_operation: write, // Existing operation, never a new job.
    select_easyeda_instance: { ...write, destructiveHint: false, idempotentHint: true },
    open_document: { ...write, destructiveHint: false, idempotentHint: true },
    save_doc: { ...write, destructiveHint: false, idempotentHint: true },
    sync_current_document: { ...write, destructiveHint: false, idempotentHint: true },
    modify_name: { ...write, idempotentHint: true },
    create_doc: { ...write, destructiveHint: false },
    delete_doc: write,
    import_pcb_changes: write, // Native document/import dialog; user confirms separately.
    extract_circuit_on_current_page: managed,
    beautify_schematic_on_current_page: managed,
    assemble_pcb_layout_on_current_pcbdoc: managed,
    annotate_designators: managed,
    save_checkpoint_for_current_page: managed, // Saving can prune retained checkpoints.
    restore_checkpoint_for_current_page: managed,
    execute_js: { ...managed, openWorldHint: true },
};

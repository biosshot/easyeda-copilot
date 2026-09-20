type ProjectPage = {
    name: string;
    itemType: unknown;
    uuid: string;
};

type ProjectSchematic = {
    name: string;
    itemType: unknown;
    page: ProjectPage[];
    uuid: string;
};

type ProjectPcb = {
    name: string;
    itemType: unknown;
    uuid: string;
    parentBoardName?: string;
};

type ProjectItem = {
    name: string;
    itemType: unknown;
    uuid?: string;
    page?: ProjectPage[];
    schematic?: ProjectSchematic | null;
    pcb?: ProjectPcb | null;
    parentBoardUuid?: string;
    parentBoardName?: string;
};

type ProjectInfo = {
    uuid: string;
    friendlyName?: string;
    description?: string;
    data: ProjectItem[];
};

type ProjectItemTypes = {
    BOARD: unknown;
    SCHEMATIC: unknown;
    PCB: unknown;
};

export function serializeProjectInfo(projectInfo: ProjectInfo, itemTypes: ProjectItemTypes) {
    const projectData = [];
    const schematic = (item: ProjectSchematic | null | undefined) => item ? {
        name: item.name,
        itemType: item.itemType,
        page: item.page.map(page => ({ name: page.name, itemType: page.itemType, uuid: page.uuid })),
        uuid: item.uuid,
    } : null;

    for (const item of projectInfo.data) {
        if (item.itemType === itemTypes.BOARD) {
            projectData.push({
                name: item.name,
                itemType: item.itemType,
                schematic: schematic(item.schematic),
                pcb: item.pcb ? {
                    name: item.pcb.name,
                    itemType: item.pcb.itemType,
                    uuid: item.pcb.uuid,
                    parentBoardName: item.pcb.parentBoardName,
                } : null,
            });
        } else if (item.itemType === itemTypes.SCHEMATIC) {
            projectData.push({
                name: item.name,
                itemType: item.itemType,
                page: (item.page ?? []).map(page => ({ name: page.name, itemType: page.itemType, uuid: page.uuid })),
                uuid: item.uuid,
                parentBoardUuid: item.parentBoardUuid,
            });
        } else if (item.itemType === itemTypes.PCB) {
            projectData.push({
                name: item.name,
                itemType: item.itemType,
                uuid: item.uuid,
                parentBoardName: item.parentBoardName,
            });
        }
    }

    return {
        project_data: projectData,
        project_uuid: projectInfo.uuid,
        project_name: projectInfo.friendlyName,
        description: projectInfo.description,
    };
}

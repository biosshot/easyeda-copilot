export interface InlineButton {
    icon: string;
    text: string;
    handler: () => unknown;
}

export interface InlineButtonsIdx {
    buttons: InlineButton[];
    idx: number;
}
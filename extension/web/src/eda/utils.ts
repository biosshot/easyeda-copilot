export const isEasyEda = () => 'eda' in window;

export const showToastMessage = (mes: string, type: "error" | "warn" | "info" | "success" | "question") => isEasyEda() ? eda.sys_Message.showToastMessage(mes, type as ESYS_ToastMessageType) : console.trace(mes)
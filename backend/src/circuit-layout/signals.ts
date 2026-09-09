/** NC describes an unconnected physical pin, never a shared electrical net. */
export const isNoConnect = (signal: string) => /^nc$/i.test(signal.trim());
export const hasConnection = (signal: string) => !!signal.trim() && !isNoConnect(signal);

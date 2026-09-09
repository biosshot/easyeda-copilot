export function isConnectedSignalName(signalName: string | undefined | null): signalName is string {
    return typeof signalName === 'string' && signalName.trim().length > 0;
}

export function isGroundSignalName(signalName: string | undefined | null): boolean {
    if (!isConnectedSignalName(signalName)) return false;
    return /^GND(?:$|[_-])/i.test(signalName) || /(?:^|[_-])GND$/i.test(signalName);
}

export function isPowerSignalName(signalName: string | undefined | null): signalName is string {
    if (!isConnectedSignalName(signalName) || isGroundSignalName(signalName)) return false;
    const value = signalName.trim();

    if (/^\+\d+(?:[._]\d+)?V\d*$/i.test(value)) return true;
    if (/^\d+(?:[._]\d+)?V\d*$/i.test(value)) return true;
    if (/^(?:VBUS|VCC|VDD|VIN|VOUT|VSYS|VBAT|BAT\+?|BATT\+?|AVDD|DVDD|IOVDD|ADC_AVDD|VREF|VREG(?:[_-].*)?)$/i.test(value)) {
        return true;
    }
    if (/^(?:\+\d+(?:[._]\d+)?V\d*|VCC|VDD|VIN|VOUT|VBAT|BAT\+?|VSYS)[_-]/i.test(value)) return true;
    if (/(?:[_-](?:VCC|VDD|VIN|VOUT|VBAT|BAT\+?|VSYS|AVDD|DVDD|IOVDD))$/i.test(value)) return true;

    return false;
}

export function isSwitchingPowerSignalName(signalName: string | undefined | null): signalName is string {
    if (!isConnectedSignalName(signalName)) return false;
    return /^(?:SW|LX|PH|BOOT|BST|SWNODE|VREG_LX)(?:$|[_-])/i.test(signalName.trim());
}

import { CircuitAssemblyStruct, ComponentAsmSchema } from "./circuit";
import { z } from "zod";

// Recalculation formula for a specific component
export const ComponentRecalcSchema = () => z.object({
    formula: z.string()
        .describe(`Recalculation formula expression example: "PARAM_xxx / 2", "PARAM_xxx_min / 2", "PARAM_xxx_max / 2", "R2 / 2", "C2 / 2", allow only: PARAM_xxx and R?
IMPORTANT! If you use R?, C?, etc., their value will be the number in their value. For example:
R1.value = 100kOhm -> R1 = 100
C1.value = 47uF -> C1 = 47`),
    unit: z.string().describe('Unit of measurement example: kOm, uF'),
    lcsc_query_template: z.string().describe('LCSC catalog search query template example: "resistor {value} smd 0603", "capacitor {value} smd 0805"; value is the result of calculating the formula + unit')
}).describe('Component recalculation parameters');

export const RecalParameters = () => z.record(z.string(), z.object({
    min: (z.number().nullable()).describe('Minimum parameter value'),
    nominal: z.number().describe('Nominal parameter value'),
    max: (z.number().nullable()).describe('Maximum parameter value'),
    allow_recalc: z.boolean().describe('Whether recalculation is allowed for this parameter')
}).describe('Parameter bounds and recalculation flag')).describe('Parameters map with min, nominal and max values')

// Global parameters and constraints
export const RecalculationMetaSchema = () => z.object({
    parameters: RecalParameters().describe('Recalculation parameters'),
    // constraints: z.array(z.string().describe('example: "PARAM_xxx_min > 2", "PARAM_xxx_max < 2"')).describe('Constraint expressions'),
    ports: z.array(z.object({
        port_number: z.string().describe('Port identifier example: "EN", "VCC", "VOUT"'),
        description: z.string().describe('Port description'),
        related_parameter: (z.string().nullable()).describe('Associated parameter name')
    }).describe('Port information')).describe('Circuit ports with descriptions')
}).describe('Recalculation metadata including parameters, constraints and ports');

// Updated assembly schema
export const CircuitAssemblyStructWithRecalc = () => CircuitAssemblyStruct().omit({ metadata: true }).extend({
    recalculation_meta: RecalculationMetaSchema().describe('Recalculation metadata'),
    components: z.array(ComponentAsmSchema().extend({
        recalc: ComponentRecalcSchema().optional().describe('Optional component recalculation')
    })).describe('Circuit components with recalculation parameters')
}).describe('Circuit assembly structure with recalculation support');

export const ReusedCategory = () => z.enum([
    "power-management",      // DC-DC, LDO, зарядка, секвенсоры
    "signal-conditioning",   // Усилители, фильтры, АЦП/ЦАП обвязка, сдвиг уровней
    "communication-interfaces", // UART, SPI, I2C, CAN, USB, Ethernet
    "mcu-embedded",          // Минимальные системы, загрузчики, тактирование МК
    "sensor-actuator",       // Интерфейсы датчиков, драйверы реле/соленоидов
    "motor-drives",          // H-мосты, шаговые, BLDC, серво
    "audio-video-display",   // Кодеки, УНЧ, буферы, драйверы дисплеев
    "protection-safety",     // ESD, TVS, reverse polarity, fuse, hot-swap
    "timing-clocking",       // Генераторы, PLL, распределение клоков, RTC
    "digital-logic",         // Буферы, триггеры, дешифраторы, сдвиговые регистры
    "rf-wireless",           // Антенные согласования, фильтры, модули BLE/Wi-Fi/LoRa
    "test-measurement"       // Калибровка, генераторы сигналов, пробники
]);

export const ReusedTags = () => z.enum([
    "buck-converter", "boost-converter", "buck-boost", "sepic-converter", "flyback-converter",
    "forward-converter", "linear-regulator", "ldo-regulator", "switching-regulator", "battery-charger",
    "li-ion-charger", "usb-pd-charger", "solar-mppt", "power-mux", "power-path-controller",
    "operational-amplifier", "instrumentation-amplifier", "differential-amplifier", "voltage-follower",
    "active-low-pass-filter", "active-high-pass-filter", "band-pass-filter", "notch-filter",
    "anti-aliasing-filter", "level-shifter", "bidirectional-level-shifter", "precision-rectifier",
    "transimpedance-amplifier", "log-amplifier", "peak-detector",
    "uart-interface", "spi-interface", "i2c-interface", "can-bus", "can-fd",
    "usb-2.0-host", "usb-c-power", "ethernet-phy", "rs-232-transceiver", "rs-485-transceiver",
    "modbus-rtu", "uart-to-usb", "i2s-interface", "pwm-controller", "gpio-expander",
    "ws2812-driver", "dmx512-interface", "mipi-dsi",
    "shift-register", "logic-buffer", "d-flip-flop", "multiplexer", "demultiplexer",
    "decoder-encoder", "binary-counter", "schmitt-trigger", "debounce-circuit", "programmable-logic",
    "temperature-sensor-ic", "humidity-sensor", "pressure-transducer", "imu-module",
    "light-sensor-photodiode", "proximity-sensor", "gas-sensor-mo320", "hall-effect-switch",
    "current-sense-amplifier", "voltage-divider-sensor", "piezo-driver", "relay-driver-mosfet",
    "thermocouple-conditioner", "rtd-sensor",
    "h-bridge-driver", "dc-motor-driver", "stepper-driver-bipolar", "bldc-controller",
    "servo-pwm-interface", "n-channel-mosfet-driver", "p-channel-mosfet-driver", "igbt-gate-driver",
    "half-bridge-driver", "full-bridge-inverter", "soft-start-circuit", "snubber-network",
    "current-feedback-loop", "voltage-feedback-loop",
    "ble-5-0-module", "wifi-esp-module", "lora-subghz", "gnss-gps-module",
    "nfc-antenna-circuit", "rfid-125khz", "rf-impedance-match", "pi-filter-match",
    "balun-transformer", "low-noise-amplifier-rf", "rf-power-amplifier",
    "esd-protection-diode", "tvs-diode-array", "surge-suppressor", "resettable-fuse",
    "circuit-breaker-ic", "optocoupler-isolator", "digital-isolator-chip", "galvanic-isolation",
    "creepage-spacing", "overcurrent-limiter", "short-circuit-clamp", "thermal-shutdown",
    "reverse-current-block", "fault-indicator-led",
    "clock-generator-ic", "clock-distributor", "pll-loop-filter", "jitter-attenuator",
    "rtc-module-i2c", "crystal-oscillator-circuit", "ceramic-resonator", "frequency-synthesizer",
    "class-d-audio-amp", "headphone-driver-ic", "electret-mic-amp", "delta-sigma-adc",
    "sar-adc", "audio-tone-control", "hdmi-level-shifter", "tft-lcd-driver",
    "precision-voltage-ref", "test-point-grid", "swd-debug-header", "jtag-14pin",
    "logic-analyzer-tap", "oscilloscope-probe-comp", "calibration-trim-pot", "load-pull-test",
    "battery-operated", "ultra-low-power", "automotive-aec100", "industrial-emi-harsh",
    "medical-iec60601", "consumer-electronics", "iot-device", "wearable-tech"
])

export const ReusedBlockSchema = () => z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string(),
    category: ReusedCategory(),
    tags: z.array(ReusedTags()),
    circuit: CircuitAssemblyStructWithRecalc(),
});

export const ReusedBlockDBSchema = () => ReusedBlockSchema().extend({
    circuit: z.string(),
    validated: z.boolean(),
    vector: z.array(z.number()),
    updated_at: z.number(),
});

export type ReusedBlock = z.infer<ReturnType<typeof ReusedBlockSchema>>;
export type ReusedBlockDB = z.infer<ReturnType<typeof ReusedBlockDBSchema>>;
export type CircuitAssemblyWithRecalc = z.infer<ReturnType<typeof CircuitAssemblyStructWithRecalc>>;

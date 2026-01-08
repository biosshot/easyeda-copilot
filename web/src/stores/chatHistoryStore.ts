import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { defaultStorage, IStorage } from './storage';

export interface ChatMessage {
    role: 'human' | 'ai';
    content: string;
    options?: Record<string, any>;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    cachedFiles: string[];
}

export const useChatHistoryStore = defineStore('chatHistory', () => {
    const storage = defaultStorage;
    const STORAGE_KEY = 'chat_history';
    const CURRENT_CHAT_KEY = 'current_chat_id';

    const chatSessions = ref<Map<string, ChatSession>>(new Map());
    const currentChatId = ref<string | null>(null);

    let cachedFilesStore: Promise<Cache | null>;

    try {
        cachedFilesStore = caches.open('circuit-ai-files').catch(_ => null);
    } catch (error) {
        cachedFilesStore = Promise.resolve(null);
    }

    // Load from storage on initialization
    function loadFromStorage() {
        try {
            const data = storage.getItem(STORAGE_KEY);
            if (data) {
                const sessions: ChatSession[] = JSON.parse(data);
                chatSessions.value = new Map(sessions.map(s => {
                    if (!s.cachedFiles) s.cachedFiles = [];
                    return [s.id, s];
                }));
            }

            const savedCurrentId = storage.getItem(CURRENT_CHAT_KEY);
            if (savedCurrentId && chatSessions.value.has(savedCurrentId)) {
                currentChatId.value = savedCurrentId;
            } else if (chatSessions.value.size > 0) {
                currentChatId.value = Array.from(chatSessions.value.keys())[0];
            }
        } catch (e) {
            console.error('Failed to load chat history from storage:', e);
            chatSessions.value = new Map();
            currentChatId.value = null;
        }
    }

    // Save to storage
    function saveToStorage() {
        try {
            const sessions = Array.from(chatSessions.value.values());
            storage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            if (currentChatId.value) {
                storage.setItem(CURRENT_CHAT_KEY, currentChatId.value);
            }
        } catch (e) {
            console.error('Failed to save chat history to storage:', e);
        }
    }

    // Create new chat session
    function createNewChat(initialMessages: ChatMessage[] = []): string {
        let id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const title = generateChatTitle(initialMessages);

        let emptyChat: string | undefined = undefined;

        chatSessions.value.forEach((chat) => {
            if (chat.messages.length === 0) {
                emptyChat = chat.id;
            }
        });

        if (emptyChat) {
            id = emptyChat;
        }

        console.log('Creating new chat session with ID:', id);

        const session: ChatSession = {
            id,
            title,
            messages: [
                ...initialMessages,

                // {
                //     role: 'ai',
                //     content: "{\"type\":\"circuit_agent_result\",\"result\":{\"circuit\":{\"metadata\":{\"project_name\":\"12V_to_5V_DC_DC_Converter\",\"description\":\"12V 입력을 받아 5V 출력을 제공하는 LM2596S-5.0 기반 벅 컨버터 회로. 입력 커넥터(J1)에서 출력 커넥터(J2)까지의 전체 전원 경로와 필요한 인덕터, 쇼트키 다이오드, 필터 커패시터, 출력 전원 표시 LED를 포함한다.\"},\"blocks\":[{\"name\":\"Input_Stage\",\"description\":\"12V 입력 커넥터와 입력 필터 커패시터로 이루어진 블록. 외부에서 들어오는 12V 전원을 수용하고 벅 컨버터 코어에 안정된 전원을 공급한다.\",\"nextBlocks\":[\"Buck_Regulator\"]},{\"name\":\"Buck_Regulator\",\"description\":\"LM2596S-5.0 스텝다운 DC-DC 컨버터 IC, 파워 인덕터, 쇼트키 다이오드, 출력 필터 커패시터로 구성된 12V→5V 벅 컨버터 코어 블록.\",\"nextBlocks\":[\"Output_Stage\"]},{\"name\":\"Output_Stage\",\"description\":\"5V 출력 커넥터와 5V 전원 상태를 표시하는 LED 인디케이터로 구성된 블록.\",\"nextBlocks\":[]}],\"components\":[{\"designator\":\"J1\",\"value\":\"KF2EDGVM-3.5-2P\",\"pins\":[{\"pin_number\":1,\"name\":\"CN1-1\",\"signal_name\":\"VIN_12V\"},{\"pin_number\":2,\"name\":\"CN1-2\",\"signal_name\":\"GND\"}],\"block_name\":\"Input_Stage\",\"searchQuery\":\"KF2EDGVM-3.5-2P 2-pin 3.5mm screw terminal\",\"partUuid\":\"76a0b41369b249fdb4eb4ed8c61fd56e\",\"pos\":{\"designator\":\"J1\",\"x\":78,\"y\":48,\"center\":{\"x\":15.000000000000002,\"y\":14.999999999999998},\"width\":30.000000000000004,\"height\":29.999999999999996,\"rotate\":90}},{\"designator\":\"C1\",\"value\":\"220uF 25V\",\"pins\":[{\"pin_number\":1,\"name\":\"POS\",\"signal_name\":\"VIN_12V\"},{\"pin_number\":2,\"name\":\"NEG\",\"signal_name\":\"GND\"}],\"block_name\":\"Input_Stage\",\"searchQuery\":\"220uF 25V electrolytic capacitor\",\"partUuid\":\"a22b004a5b824e858a8300392307adeb\",\"pos\":{\"designator\":\"C1\",\"x\":111.5,\"y\":153,\"center\":{\"x\":8.5,\"y\":15},\"width\":17,\"height\":30,\"rotate\":0}},{\"designator\":\"C2\",\"value\":\"100nF 50V\",\"pins\":[{\"pin_number\":1,\"name\":\"POS\",\"signal_name\":\"VIN_12V\"},{\"pin_number\":2,\"name\":\"NEG\",\"signal_name\":\"GND\"}],\"block_name\":\"Input_Stage\",\"searchQuery\":\"100nF 50V ceramic capacitor\",\"partUuid\":\"225deecd4f524c4eb096096a7b9a54db\",\"pos\":{\"designator\":\"C2\",\"x\":54.5,\"y\":148,\"center\":{\"x\":8.499999999999998,\"y\":20},\"width\":16.999999999999996,\"height\":40,\"rotate\":180}},{\"designator\":\"U1\",\"value\":\"LM2596S-5.0\",\"pins\":[{\"pin_number\":1,\"name\":\"VIN\",\"signal_name\":\"VIN_12V\"},{\"pin_number\":2,\"name\":\"OUTPUT\",\"signal_name\":\"SW\"},{\"pin_number\":3,\"name\":\"GND\",\"signal_name\":\"GND\"},{\"pin_number\":4,\"name\":\"FEEDBACK\",\"signal_name\":\"VOUT_5V\"},{\"pin_number\":5,\"name\":\"NO#/OFF\",\"signal_name\":\"VIN_12V\"},{\"pin_number\":6,\"name\":\"GND\",\"signal_name\":\"GND\"}],\"block_name\":\"Buck_Regulator\",\"searchQuery\":\"LM2596S-5.0 5V buck regulator\",\"partUuid\":\"d1ae088a5c2d4650a59c876c0db46852\",\"pos\":{\"designator\":\"U1\",\"x\":318.53,\"y\":344,\"center\":{\"x\":40,\"y\":30},\"width\":80,\"height\":60,\"rotate\":0}},{\"designator\":\"L1\",\"value\":\"33uH YPRH1207-330M\",\"pins\":[{\"pin_number\":1,\"name\":\"Terminal 1\",\"signal_name\":\"SW\"},{\"pin_number\":2,\"name\":\"Terminal 2\",\"signal_name\":\"VOUT_5V\"}],\"block_name\":\"Buck_Regulator\",\"searchQuery\":\"YPRH1207-330M 33uH inductor\",\"partUuid\":\"d647a0c3294147c0bff7daee214f4897\",\"pos\":{\"designator\":\"L1\",\"x\":168.52999999999997,\"y\":428.8608874822761,\"center\":{\"x\":20,\"y\":2.639112517723917},\"width\":40,\"height\":5.278225035447834,\"rotate\":540}},{\"designator\":\"D1\",\"value\":\"SS34\",\"pins\":[{\"pin_number\":1,\"name\":\"K\",\"signal_name\":\"SW\"},{\"pin_number\":2,\"name\":\"A\",\"signal_name\":\"GND\"}],\"block_name\":\"Buck_Regulator\",\"searchQuery\":\"SS34 schottky diode\",\"partUuid\":\"8dfc00babdc34003b9d28260245ada16\",\"pos\":{\"designator\":\"D1\",\"x\":238.52999999999997,\"y\":424,\"center\":{\"x\":20,\"y\":7.50000000000001},\"width\":40,\"height\":15.00000000000002,\"rotate\":540}},{\"designator\":\"C3\",\"value\":\"330uF 16V\",\"pins\":[{\"pin_number\":1,\"name\":\"POS\",\"signal_name\":\"VOUT_5V\"},{\"pin_number\":2,\"name\":\"NEG\",\"signal_name\":\"GND\"}],\"block_name\":\"Buck_Regulator\",\"searchQuery\":\"330uF 16V electrolytic capacitor\",\"partUuid\":\"1ddf487812434753a9654bb025b910df\",\"pos\":{\"designator\":\"C3\",\"x\":111.5,\"y\":356,\"center\":{\"x\":7.514999999999996,\"y\":20},\"width\":15.029999999999992,\"height\":40,\"rotate\":-90}},{\"designator\":\"C4\",\"value\":\"100nF 16V\",\"pins\":[{\"pin_number\":1,\"name\":\"POS\",\"signal_name\":\"VOUT_5V\"},{\"pin_number\":2,\"name\":\"NEG\",\"signal_name\":\"GND\"}],\"block_name\":\"Buck_Regulator\",\"searchQuery\":\"100nF 16V ceramic capacitor\",\"partUuid\":\"225deecd4f524c4eb096096a7b9a54db\",\"pos\":{\"designator\":\"C4\",\"x\":54.5,\"y\":356,\"center\":{\"x\":8.499999999999998,\"y\":20},\"width\":16.999999999999996,\"height\":40,\"rotate\":180}},{\"designator\":\"J2\",\"value\":\"KF2EDGVM-3.5-2P\",\"pins\":[{\"pin_number\":1,\"name\":\"CN1-1\",\"signal_name\":\"VOUT_5V\"},{\"pin_number\":2,\"name\":\"CN1-2\",\"signal_name\":\"GND\"}],\"block_name\":\"Output_Stage\",\"searchQuery\":\"KF2EDGVM-3.5-2P 2-pin 3.5mm screw terminal\",\"partUuid\":\"76a0b41369b249fdb4eb4ed8c61fd56e\",\"pos\":{\"designator\":\"J2\",\"x\":350.5,\"y\":66,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"designator\":\"R1\",\"value\":\"1k\",\"pins\":[{\"pin_number\":1,\"name\":\"1\",\"signal_name\":\"VOUT_5V\"},{\"pin_number\":2,\"name\":\"2\",\"signal_name\":\"LED1_A\"}],\"block_name\":\"Output_Stage\",\"searchQuery\":\"1k 1/4W resistor\",\"partUuid\":\"2340647df7144fc5a30489ed06518eb5\",\"pos\":{\"designator\":\"R1\",\"x\":240.5,\"y\":72,\"center\":{\"x\":20,\"y\":4.000000000000002},\"width\":40,\"height\":8.000000000000004,\"rotate\":180}},{\"designator\":\"LED1\",\"value\":\"PSC-1608U52GC-G4\",\"pins\":[{\"pin_number\":1,\"name\":\"K\",\"signal_name\":\"GND\"},{\"pin_number\":2,\"name\":\"A\",\"signal_name\":\"LED1_A\"}],\"block_name\":\"Output_Stage\",\"searchQuery\":\"PSC-1608U52GC-G4 green LED\",\"partUuid\":\"26f3af1c790b4354bdea7582230e7a5e\",\"pos\":{\"designator\":\"LED1\",\"x\":195.5,\"y\":86,\"center\":{\"x\":12.499999999999995,\"y\":20},\"width\":24.99999999999999,\"height\":40,\"rotate\":450}},{\"block_name\":\"block_parl_J1_C1_C2\",\"designator\":\"GND|fc39\",\"partUuid\":\"GND\",\"searchQuery\":\"\",\"value\":\"GND\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"GND\"}],\"pos\":{\"designator\":\"GND|fc39\",\"x\":48,\"y\":208,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_parl_J1_C1_C2\",\"designator\":\"VIN_12V|168e\",\"partUuid\":\"7523d33c197549a39030c4ac7fddee68\",\"searchQuery\":\"\",\"value\":\"VIN_12V\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"VIN_12V\"}],\"pos\":{\"designator\":\"VIN_12V|168e\",\"x\":48,\"y\":98,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_Buck_Regulator\",\"designator\":\"GND|e463\",\"partUuid\":\"GND\",\"searchQuery\":\"\",\"value\":\"GND\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"GND\"}],\"pos\":{\"designator\":\"GND|e463\",\"x\":393.53,\"y\":459,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_Buck_Regulator\",\"designator\":\"VIN_12V|fa30\",\"partUuid\":\"7523d33c197549a39030c4ac7fddee68\",\"searchQuery\":\"\",\"value\":\"VIN_12V\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"VIN_12V\"}],\"pos\":{\"designator\":\"VIN_12V|fa30\",\"x\":293.53,\"y\":294,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_Buck_Regulator\",\"designator\":\"VOUT_5V|d361\",\"partUuid\":\"7523d33c197549a39030c4ac7fddee68\",\"searchQuery\":\"\",\"value\":\"VOUT_5V\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"VOUT_5V\"}],\"pos\":{\"designator\":\"VOUT_5V|d361\",\"x\":223.52999999999997,\"y\":294,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_parl_C3_C4\",\"designator\":\"GND|e9b2\",\"partUuid\":\"GND\",\"searchQuery\":\"\",\"value\":\"GND\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"GND\"}],\"pos\":{\"designator\":\"GND|e9b2\",\"x\":48,\"y\":416,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_parl_C3_C4\",\"designator\":\"VOUT_5V|73b0\",\"partUuid\":\"7523d33c197549a39030c4ac7fddee68\",\"searchQuery\":\"\",\"value\":\"VOUT_5V\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"VOUT_5V\"}],\"pos\":{\"designator\":\"VOUT_5V|73b0\",\"x\":48,\"y\":306,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_Output_Stage\",\"designator\":\"GND|aefb\",\"partUuid\":\"GND\",\"searchQuery\":\"\",\"value\":\"GND\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"GND\"}],\"pos\":{\"designator\":\"GND|aefb\",\"x\":300.5,\"y\":146,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}},{\"block_name\":\"block_Output_Stage\",\"designator\":\"VOUT_5V|2abc\",\"partUuid\":\"7523d33c197549a39030c4ac7fddee68\",\"searchQuery\":\"\",\"value\":\"VOUT_5V\",\"pins\":[{\"name\":\"1\",\"pin_number\":1,\"signal_name\":\"VOUT_5V\"}],\"pos\":{\"designator\":\"VOUT_5V|2abc\",\"x\":300.5,\"y\":36,\"center\":{\"x\":15,\"y\":15},\"width\":30,\"height\":30,\"rotate\":0}}],\"edges\":[{\"id\":\"edge_GND|fc39_0\",\"sources\":[\"J1_pin_2\"],\"targets\":[\"GND|fc39_pin_1\"],\"sections\":[{\"id\":\"edge_GND|fc39_0_s0\",\"startPoint\":{\"x\":98,\"y\":78},\"endPoint\":{\"x\":63,\"y\":213},\"bendPoints\":[{\"x\":98,\"y\":88},{\"x\":138.5,\"y\":88},{\"x\":138.5,\"y\":198},{\"x\":63,\"y\":198}],\"incomingShape\":\"J1_pin_2\",\"outgoingShape\":\"GND|fc39_pin_1\"}],\"junctionPoints\":[{\"x\":27,\"y\":162}],\"container\":\"block_parl_J1_C1_C2\"},{\"id\":\"edge_GND|fc39_1\",\"sources\":[\"C1_pin_2\"],\"targets\":[\"GND|fc39_pin_1\"],\"sections\":[{\"id\":\"edge_GND|fc39_1_s0\",\"startPoint\":{\"x\":120,\"y\":183},\"endPoint\":{\"x\":63,\"y\":213},\"bendPoints\":[{\"x\":120,\"y\":198},{\"x\":63,\"y\":198}],\"incomingShape\":\"C1_pin_2\",\"outgoingShape\":\"GND|fc39_pin_1\"}],\"junctionPoints\":[{\"x\":84,\"y\":162}],\"container\":\"block_parl_J1_C1_C2\"},{\"id\":\"edge_GND|fc39_2\",\"sources\":[\"C2_pin_2\"],\"targets\":[\"GND|fc39_pin_1\"],\"sections\":[{\"id\":\"edge_GND|fc39_2_s0\",\"startPoint\":{\"x\":63,\"y\":188},\"endPoint\":{\"x\":63,\"y\":213},\"incomingShape\":\"C2_pin_2\",\"outgoingShape\":\"GND|fc39_pin_1\"}],\"container\":\"block_parl_J1_C1_C2\"},{\"id\":\"edge_SW_3\",\"sources\":[\"L1_pin_1\"],\"targets\":[\"U1_pin_2\"],\"sections\":[{\"id\":\"edge_SW_3_s0\",\"startPoint\":{\"x\":208.52999999999997,\"y\":429.30620880472424},\"endPoint\":{\"x\":318.53,\"y\":364},\"bendPoints\":[{\"x\":218.52999999999997,\"y\":429.30620880472424},{\"x\":218.52999999999997,\"y\":414},{\"x\":288.53,\"y\":414},{\"x\":288.53,\"y\":364}],\"incomingShape\":\"L1_pin_1\",\"outgoingShape\":\"U1_pin_2\"}],\"junctionPoints\":[{\"x\":264.53,\"y\":132}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_SW_4\",\"sources\":[\"D1_pin_1\"],\"targets\":[\"U1_pin_2\"],\"sections\":[{\"id\":\"edge_SW_4_s0\",\"startPoint\":{\"x\":278.53,\"y\":431.5},\"endPoint\":{\"x\":318.53,\"y\":364},\"bendPoints\":[{\"x\":288.53,\"y\":431.5},{\"x\":288.53,\"y\":364}],\"incomingShape\":\"D1_pin_1\",\"outgoingShape\":\"U1_pin_2\"}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_GND|e463_5\",\"sources\":[\"U1_pin_3\"],\"targets\":[\"GND|e463_pin_1\"],\"sections\":[{\"id\":\"edge_GND|e463_5_s0\",\"startPoint\":{\"x\":318.53,\"y\":374},\"endPoint\":{\"x\":408.53,\"y\":464},\"bendPoints\":[{\"x\":298.53,\"y\":374},{\"x\":298.53,\"y\":414},{\"x\":408.53,\"y\":414}],\"incomingShape\":\"U1_pin_3\",\"outgoingShape\":\"GND|e463_pin_1\"}],\"junctionPoints\":[{\"x\":384.53,\"y\":132}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_GND|e463_6\",\"sources\":[\"U1_pin_6\"],\"targets\":[\"GND|e463_pin_1\"],\"sections\":[{\"id\":\"edge_GND|e463_6_s0\",\"startPoint\":{\"x\":398.53,\"y\":374},\"endPoint\":{\"x\":408.53,\"y\":464},\"bendPoints\":[{\"x\":408.53,\"y\":374}],\"incomingShape\":\"U1_pin_6\",\"outgoingShape\":\"GND|e463_pin_1\"}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_GND|e463_7\",\"sources\":[\"D1_pin_2\"],\"targets\":[\"GND|e463_pin_1\"],\"sections\":[{\"id\":\"edge_GND|e463_7_s0\",\"startPoint\":{\"x\":238.52999999999997,\"y\":431.5},\"endPoint\":{\"x\":408.53,\"y\":464},\"bendPoints\":[{\"x\":228.52999999999997,\"y\":431.5},{\"x\":228.52999999999997,\"y\":449},{\"x\":408.53,\"y\":449}],\"incomingShape\":\"D1_pin_2\",\"outgoingShape\":\"GND|e463_pin_1\"}],\"junctionPoints\":[{\"x\":384.53,\"y\":167}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_GND|e9b2_8\",\"sources\":[\"C3_pin_2\"],\"targets\":[\"GND|e9b2_pin_1\"],\"sections\":[{\"id\":\"edge_GND|e9b2_8_s0\",\"startPoint\":{\"x\":119,\"y\":396},\"endPoint\":{\"x\":63,\"y\":421},\"bendPoints\":[{\"x\":119,\"y\":406},{\"x\":63,\"y\":406}],\"incomingShape\":\"C3_pin_2\",\"outgoingShape\":\"GND|e9b2_pin_1\"}],\"junctionPoints\":[{\"x\":27,\"y\":112}],\"container\":\"block_parl_C3_C4\"},{\"id\":\"edge_GND|e9b2_9\",\"sources\":[\"C4_pin_2\"],\"targets\":[\"GND|e9b2_pin_1\"],\"sections\":[{\"id\":\"edge_GND|e9b2_9_s0\",\"startPoint\":{\"x\":63,\"y\":396},\"endPoint\":{\"x\":63,\"y\":421},\"incomingShape\":\"C4_pin_2\",\"outgoingShape\":\"GND|e9b2_pin_1\"}],\"container\":\"block_parl_C3_C4\"},{\"id\":\"edge_GND|aefb_10\",\"sources\":[\"J2_pin_2\"],\"targets\":[\"GND|aefb_pin_1\"],\"sections\":[{\"id\":\"edge_GND|aefb_10_s0\",\"startPoint\":{\"x\":350.5,\"y\":86},\"endPoint\":{\"x\":315.5,\"y\":151},\"bendPoints\":[{\"x\":340.5,\"y\":86},{\"x\":340.5,\"y\":136},{\"x\":315.5,\"y\":136}],\"incomingShape\":\"J2_pin_2\",\"outgoingShape\":\"GND|aefb_pin_1\"}],\"junctionPoints\":[{\"x\":132,\"y\":112}],\"container\":\"block_Output_Stage\"},{\"id\":\"edge_GND|aefb_11\",\"sources\":[\"LED1_pin_1\"],\"targets\":[\"GND|aefb_pin_1\"],\"sections\":[{\"id\":\"edge_GND|aefb_11_s0\",\"startPoint\":{\"x\":213,\"y\":126},\"endPoint\":{\"x\":315.5,\"y\":151},\"bendPoints\":[{\"x\":213,\"y\":136},{\"x\":315.5,\"y\":136}],\"incomingShape\":\"LED1_pin_1\",\"outgoingShape\":\"GND|aefb_pin_1\"}],\"junctionPoints\":[{\"x\":132,\"y\":112}],\"container\":\"block_Output_Stage\"},{\"id\":\"edge_LED1_A_12\",\"sources\":[\"LED1_pin_2\"],\"targets\":[\"R1_pin_2\"],\"sections\":[{\"id\":\"edge_LED1_A_12_s0\",\"startPoint\":{\"x\":213,\"y\":86},\"endPoint\":{\"x\":240.5,\"y\":76},\"bendPoints\":[{\"x\":213,\"y\":76}],\"incomingShape\":\"LED1_pin_2\",\"outgoingShape\":\"R1_pin_2\"}],\"container\":\"block_Output_Stage\"},{\"id\":\"edge_ext_block_parl_J1_C1_C2_VIN_12V_13\",\"sources\":[\"J1_pin_1\"],\"targets\":[\"VIN_12V|168e_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_parl_J1_C1_C2_VIN_12V_13_s0\",\"startPoint\":{\"x\":88,\"y\":78},\"endPoint\":{\"x\":63,\"y\":123},\"bendPoints\":[{\"x\":88,\"y\":138},{\"x\":63,\"y\":138}],\"incomingShape\":\"J1_pin_1\",\"outgoingShape\":\"VIN_12V|168e_pin_1\"}],\"junctionPoints\":[{\"x\":27.000000000000004,\"y\":102},{\"x\":52,\"y\":102}],\"container\":\"block_parl_J1_C1_C2\"},{\"id\":\"edge_ext_block_parl_J1_C1_C2_VIN_12V_14\",\"sources\":[\"C1_pin_1\"],\"targets\":[\"VIN_12V|168e_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_parl_J1_C1_C2_VIN_12V_14_s0\",\"startPoint\":{\"x\":120,\"y\":153},\"endPoint\":{\"x\":63,\"y\":123},\"bendPoints\":[{\"x\":120,\"y\":138},{\"x\":63,\"y\":138}],\"incomingShape\":\"C1_pin_1\",\"outgoingShape\":\"VIN_12V|168e_pin_1\"}],\"container\":\"block_parl_J1_C1_C2\"},{\"id\":\"edge_ext_block_parl_J1_C1_C2_VIN_12V_15\",\"sources\":[\"C2_pin_1\"],\"targets\":[\"VIN_12V|168e_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_parl_J1_C1_C2_VIN_12V_15_s0\",\"startPoint\":{\"x\":63,\"y\":148},\"endPoint\":{\"x\":63,\"y\":123},\"incomingShape\":\"C2_pin_1\",\"outgoingShape\":\"VIN_12V|168e_pin_1\"}],\"container\":\"block_parl_J1_C1_C2\"},{\"id\":\"edge_ext_block_parl_C3_C4_VOUT_5V_16\",\"sources\":[\"C3_pin_1\"],\"targets\":[\"VOUT_5V|73b0_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_parl_C3_C4_VOUT_5V_16_s0\",\"startPoint\":{\"x\":119,\"y\":356},\"endPoint\":{\"x\":63,\"y\":331},\"bendPoints\":[{\"x\":119,\"y\":346},{\"x\":63,\"y\":346}],\"incomingShape\":\"C3_pin_1\",\"outgoingShape\":\"VOUT_5V|73b0_pin_1\"}],\"junctionPoints\":[{\"x\":27.000000000000004,\"y\":52}],\"container\":\"block_parl_C3_C4\"},{\"id\":\"edge_ext_block_parl_C3_C4_VOUT_5V_17\",\"sources\":[\"C4_pin_1\"],\"targets\":[\"VOUT_5V|73b0_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_parl_C3_C4_VOUT_5V_17_s0\",\"startPoint\":{\"x\":63,\"y\":356},\"endPoint\":{\"x\":63,\"y\":331},\"incomingShape\":\"C4_pin_1\",\"outgoingShape\":\"VOUT_5V|73b0_pin_1\"}],\"container\":\"block_parl_C3_C4\"},{\"id\":\"edge_ext_block_Buck_Regulator_VIN_12V_18\",\"sources\":[\"U1_pin_1\"],\"targets\":[\"VIN_12V|fa30_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_Buck_Regulator_VIN_12V_18_s0\",\"startPoint\":{\"x\":318.53,\"y\":354},\"endPoint\":{\"x\":308.53,\"y\":319},\"bendPoints\":[{\"x\":278.53,\"y\":354},{\"x\":278.53,\"y\":334},{\"x\":308.53,\"y\":334}],\"incomingShape\":\"U1_pin_1\",\"outgoingShape\":\"VIN_12V|fa30_pin_1\"}],\"junctionPoints\":[{\"x\":284.53,\"y\":52}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_ext_block_Buck_Regulator_VIN_12V_19\",\"sources\":[\"U1_pin_5\"],\"targets\":[\"VIN_12V|fa30_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_Buck_Regulator_VIN_12V_19_s0\",\"startPoint\":{\"x\":318.53,\"y\":394},\"endPoint\":{\"x\":308.53,\"y\":319},\"bendPoints\":[{\"x\":308.53,\"y\":394}],\"incomingShape\":\"U1_pin_5\",\"outgoingShape\":\"VIN_12V|fa30_pin_1\"}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_ext_block_Buck_Regulator_VOUT_5V_20\",\"sources\":[\"U1_pin_4\"],\"targets\":[\"VOUT_5V|d361_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_Buck_Regulator_VOUT_5V_20_s0\",\"startPoint\":{\"x\":318.53,\"y\":384},\"endPoint\":{\"x\":238.52999999999997,\"y\":319},\"bendPoints\":[{\"x\":238.52999999999997,\"y\":384}],\"incomingShape\":\"U1_pin_4\",\"outgoingShape\":\"VOUT_5V|d361_pin_1\"}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_ext_block_Buck_Regulator_VOUT_5V_21\",\"sources\":[\"L1_pin_2\"],\"targets\":[\"VOUT_5V|d361_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_Buck_Regulator_VOUT_5V_21_s0\",\"startPoint\":{\"x\":168.52999999999997,\"y\":429.3062088047242},\"endPoint\":{\"x\":238.52999999999997,\"y\":319},\"bendPoints\":[{\"x\":158.52999999999997,\"y\":429.3062088047242},{\"x\":158.52999999999997,\"y\":334},{\"x\":238.52999999999997,\"y\":334}],\"incomingShape\":\"L1_pin_2\",\"outgoingShape\":\"VOUT_5V|d361_pin_1\"}],\"junctionPoints\":[{\"x\":214.52999999999997,\"y\":52}],\"container\":\"block_Buck_Regulator\"},{\"id\":\"edge_ext_block_Output_Stage_VOUT_5V_22\",\"sources\":[\"J2_pin_1\"],\"targets\":[\"VOUT_5V|2abc_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_Output_Stage_VOUT_5V_22_s0\",\"startPoint\":{\"x\":350.5,\"y\":76},\"endPoint\":{\"x\":315.5,\"y\":61},\"bendPoints\":[{\"x\":315.5,\"y\":76}],\"incomingShape\":\"J2_pin_1\",\"outgoingShape\":\"VOUT_5V|2abc_pin_1\"}],\"junctionPoints\":[{\"x\":132,\"y\":52}],\"container\":\"block_Output_Stage\"},{\"id\":\"edge_ext_block_Output_Stage_VOUT_5V_23\",\"sources\":[\"R1_pin_1\"],\"targets\":[\"VOUT_5V|2abc_pin_1\"],\"sections\":[{\"id\":\"edge_ext_block_Output_Stage_VOUT_5V_23_s0\",\"startPoint\":{\"x\":280.5,\"y\":76},\"endPoint\":{\"x\":315.5,\"y\":61},\"bendPoints\":[{\"x\":315.5,\"y\":76}],\"incomingShape\":\"R1_pin_1\",\"outgoingShape\":\"VOUT_5V|2abc_pin_1\"}],\"junctionPoints\":[{\"x\":132,\"y\":52}],\"container\":\"block_Output_Stage\"}],\"blocksRect\":[{\"name\":\"block___v_root__\",\"description\":\"\",\"x\":12,\"y\":12,\"width\":435.53,\"height\":501},{\"name\":\"block_Input_Stage\",\"description\":\"12V 입력 커넥터와 입력 필터 커패시터로 이루어진 블록. 외부에서 들어오는 12V 전원을 수용하고 벅 컨버터 코어에 안정된 전원을 공급한다.\",\"x\":24,\"y\":24,\"width\":139.5,\"height\":238},{\"name\":\"block_Buck_Regulator\",\"description\":\"LM2596S-5.0 스텝다운 DC-DC 컨버터 IC, 파워 인덕터, 쇼트키 다이오드, 출력 필터 커패시터로 구성된 12V→5V 벅 컨버터 코어 블록.\",\"x\":24,\"y\":282,\"width\":411.53,\"height\":219},{\"name\":\"block_Output_Stage\",\"description\":\"5V 출력 커넥터와 5V 전원 상태를 표시하는 LED 인디케이터로 구성된 블록.\",\"x\":183.5,\"y\":24,\"width\":209,\"height\":164}]},\"blockDiagram\":\"/temp/191cdb5a-1849-448e-b201-520e81b66b27.pdf\"}}"
                // }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cachedFiles: []
        };

        chatSessions.value.set(id, session);
        currentChatId.value = id;
        saveToStorage();

        return id;
    }

    // Get current chat session
    function getCurrentChat(): ChatSession | null {
        if (!currentChatId.value) {
            createNewChat();
        }

        return chatSessions.value.get(currentChatId.value ?? '') || null;
    }

    // Get all chat sessions (sorted by most recent first)
    function getAllChats(): ChatSession[] {
        return Array.from(chatSessions.value.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt
        );
    }

    // Switch to a specific chat
    function switchToChat(id: string): boolean {
        if (!chatSessions.value.has(id)) {
            return false;
        }
        currentChatId.value = id;
        saveToStorage();
        return true;
    }

    // Delete a chat session
    async function deleteChat(id: string): Promise<boolean> {
        const chat = chatSessions.value.get(id);
        if (!chat) return false;

        const deleted = chatSessions.value.delete(id);

        if (deleted) {
            const store = await cachedFilesStore;
            if (store) {
                for (const file of chat.cachedFiles) {
                    await store.delete(file).catch(e => {
                        console.error('Failed to delete cached file:', file, e);
                    })
                }
            }

            // If deleted chat was current, switch to another or clear
            if (currentChatId.value === id) {
                const remaining = Array.from(chatSessions.value.keys());
                currentChatId.value = remaining.length > 0 ? remaining[0] : null;
            }
            saveToStorage();
        }

        return deleted;
    }

    // Add message to current chat
    function addMessageToCurrentChat(message: ChatMessage): boolean {
        const chat = getCurrentChat();
        if (!chat) return false;

        if (chat.title === 'New Chat') {
            chat.title = generateChatTitle(chat.messages);
        }

        chat.messages.push(message);
        chat.updatedAt = Date.now();
        saveToStorage();

        return true;
    }

    function setMessagesToCurrentChat(message: ChatMessage[]): boolean {
        const chat = getCurrentChat();
        if (!chat) return false;

        if (chat.title === 'New Chat') {
            chat.title = generateChatTitle(chat.messages);
        }

        chat.messages = message;
        chat.updatedAt = Date.now();
        saveToStorage();

        return true;
    }

    // Add cached file to current chat
    async function addCachedFile(filename: string, blob: Blob) {
        const chat = getCurrentChat();
        if (chat && !chat.cachedFiles.includes(filename)) {
            chat.cachedFiles.push(filename);
            const store = await cachedFilesStore;

            if (store) {
                store.put(filename, new Response(blob)).catch(e => {
                    console.error('Failed to cache file:', filename, e);
                }).then(() => {
                    console.log('Cached file:', filename);
                });
            }

            saveToStorage();
        }
    }

    async function readCachedFile(filename: string): Promise<Blob | null> {
        const store = await cachedFilesStore;

        if (store) {
            return store.match(filename).then(response => response ? response.blob() : null).catch(() => null);
        }

        return null
    }

    // Update chat title
    function updateChatTitle(id: string, title: string): boolean {
        const chat = chatSessions.value.get(id);
        if (!chat) return false;

        chat.title = title;
        chat.updatedAt = Date.now();
        saveToStorage();

        return true;
    }

    // Clear all chat history
    async function clearAllChats(): Promise<void> {
        // Delete all cached files
        const store = await cachedFilesStore;

        if (store) {
            for (const chat of chatSessions.value.values()) {
                for (const file of chat.cachedFiles) {
                    await store.delete(file).catch(e => {
                        console.error('Failed to delete cached file:', file, e);
                    })
                }
            }
        }

        chatSessions.value.clear();
        currentChatId.value = null;
        storage.removeItem(STORAGE_KEY);
        storage.removeItem(CURRENT_CHAT_KEY);
    }

    // Check if current chat is empty
    function isCurrentChatEmpty(): boolean {
        const chat = getCurrentChat();
        return !chat || chat.messages.length === 0;
    }

    // Generate chat title from messages
    function generateChatTitle(messages: ChatMessage[]): string {
        if (messages.length === 0) return 'New Chat';

        // Find first human message and extract first words
        const firstHuman = messages.find(m => m.role === 'human');
        if (firstHuman && firstHuman.content) {
            const words = firstHuman.content.split(/\s+/).slice(0, 5).join(' ');
            return words.length > 30 ? words.slice(0, 30) + '...' : words || 'New Chat';
        }

        return 'New Chat';
    }

    // Initialize on store creation
    loadFromStorage();

    return {
        chatSessions: computed(() => chatSessions.value),
        currentChatId: computed(() => currentChatId.value),
        getCurrentChat,
        getAllChats,
        createNewChat,
        switchToChat,
        deleteChat,
        addMessageToCurrentChat,
        setMessagesToCurrentChat,
        addCachedFile,
        readCachedFile,
        updateChatTitle,
        clearAllChats,
        isCurrentChatEmpty,
        loadFromStorage,
        saveToStorage,
    };
});

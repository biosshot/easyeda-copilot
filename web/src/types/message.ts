export interface Message {
    role: 'ai' | 'human';
    content: string;
    options?: {
        [key: string]: unknown
    },
}
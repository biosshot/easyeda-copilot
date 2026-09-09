import pino from 'pino';
export default pino({ level: process.env.EDA_BACKEND_LOG_LEVEL || 'warn' }, pino.destination(2));

/**
 * graasp-websockets
 * 
 * Local configuration for graasp-websockets plugin
 * 
 * @author Alexandre CHAU
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
    redis: {
        port: (process.env.REDIS_PORT !== undefined) ? parseInt(process.env.REDIS_PORT, 10) : 6379,
        host: process.env.REDIS_HOST || "127.0.0.1",
        password: process.env.REDIS_PWD || undefined,
        notifChannel: process.env.REDIS_NOTIF_CHANNEL || "graasp-notif",
    },
};

export default config;
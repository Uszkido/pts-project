export type AppType = 'MERCHANT' | 'SENTINEL' | 'COMMAND' | 'CONSUMER' | 'LANDING';

export const APP_CONFIG = {
    TYPE: 'LANDING' as AppType,
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
};

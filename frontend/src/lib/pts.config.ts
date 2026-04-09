export type AppType = 'MERCHANT' | 'SENTINEL' | 'COMMAND' | 'CONSUMER' | 'LANDING';

export const APP_CONFIG = {
    TYPE: 'LANDING' as AppType,
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://pts-backend-api.vercel.app/api/v1',
};

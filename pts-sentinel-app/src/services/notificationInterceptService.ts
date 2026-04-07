/**
 * PTS Sentinel - Notification Interception Service
 * Integration derived from TrackPhoneAndroid
 * 
 * Note: To execute this correctly on the backend Android build, 
 * you will need a Capacitor Java Plugin that binds to `NotificationListenerService`.
 * This TS service acts as the proxy to send the intercepted data to the PTS Backend.
 */

const PTS_API_TRACKING = import.meta.env.VITE_PTS_API_URL
    ? `${import.meta.env.VITE_PTS_API_URL}/tracking`
    : 'https://pts-backend-main-project.onrender.com/api/v1/tracking';

export interface InterceptedNotification {
    deviceId: string;
    packageName: string;
    title: string;
    content: string;
    timestamp: number;
}

class NotificationInterceptService {

    /**
     * Called natively by the Capacitor Plugin when a notification is caught.
     */
    async logIntercept(data: InterceptedNotification) {
        try {
            console.log(`[SENTINEL INTERCEPT] Tracking notification from ${data.packageName}`);

            const token = localStorage.getItem('pts_sentinel_token');
            const res = await fetch(`${PTS_API_TRACKING}/notification-intercept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                console.error('[SENTINEL INTERCEPT] Failed to sync interception to backend');
            }
        } catch (err) {
            console.error('[SENTINEL INTERCEPT ERROR]', err);
        }
    }
}

export const notificationInterceptService = new NotificationInterceptService();

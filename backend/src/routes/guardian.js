const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { reverseGeocode, checkGeofence } = require('../services/geoService');
const { sendPushNotification } = require('../services/pushService');

// Guardian Mesh: Report a proximity detection
router.post('/report', async (req, res) => {
    try {
        const { deviceImei, latitude, longitude, signalType, signalStrength, observerId } = req.body;

        if (!deviceImei || !signalType) {
            return res.status(400).json({ error: 'IMEI and signal type are required' });
        }

        const device = await prisma.device.findUnique({ where: { imei: deviceImei } });
        if (!device) return res.status(404).json({ error: 'Device not found' });

        // Create the observation report
        const report = await prisma.observationReport.create({
            data: {
                deviceId: device.id,
                latitude,
                longitude,
                signalType,
                signalStrength,
                observerId
            }
        });

        // Update device's last known mesh signature
        let newLocation = device.lastKnownLocation;
        if (latitude && longitude) {
            newLocation = await reverseGeocode(latitude, longitude);
        }

        await prisma.device.update({
            where: { id: device.id },
            data: {
                lastBluetoothSig: signalType === 'BT' ? observerId : device.lastBluetoothSig,
                lastWifiSig: signalType === 'WIFI' ? observerId : device.lastWifiSig,
                lastObservationDate: new Date(),
                lastKnownLocation: newLocation
            }
        });

        // Geofence detection — escalate if spotted in a known high-risk market
        const geofence = checkGeofence(latitude, longitude);

        // If device is STOLEN or LOST, trigger an alert
        if (['STOLEN', 'LOST'].includes(device.status)) {
            const zoneWarning = geofence.isHighRisk
                ? `⚠️ HIGH-RISK ZONE: ${geofence.zoneName} (${geofence.distanceMeters}m from centre). `
                : '';

            await sendPushNotification(
                device.registeredOwnerId,
                `🚨 GUARDIAN DETECTED: ${device.brand} ${device.model}`,
                `${zoneWarning}A nearby Sentinel Node just verified your stolen device at ${newLocation}. Do not intervene yourself. Check live map now!`,
                { deviceId: device.id, route: '/app/map', alarm: true, type: 'MESH_PULSE', isHighRiskZone: geofence.isHighRisk }
            );
            console.log(`[GUARDIAN ALERT] Stolen device ${deviceImei} detected by node ${observerId}${geofence.isHighRisk ? ` — HIGH RISK ZONE: ${geofence.zoneName}` : ''}`);
        }

        res.status(201).json({ message: 'Observation reported successfully', reportId: report.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        await prisma.device.update({
            where: { id: device.id },
            data: {
                lastBluetoothSig: signalType === 'BT' ? observerId : device.lastBluetoothSig,
                lastWifiSig: signalType === 'WIFI' ? observerId : device.lastWifiSig,
                lastObservationDate: new Date(),
                lastKnownLocation: latitude && longitude ? `${latitude}, ${longitude}` : device.lastKnownLocation
            }
        });

        // If device is STOLEN or LOST, trigger an alert (logic can be expanded)
        if (['STOLEN', 'LOST'].includes(device.status)) {
            // Potential for push notifications or live socket updates
            console.log(`[GUARDIAN ALERT] Stolen device ${deviceImei} detected by node ${observerId}`);
        }

        res.status(201).json({ message: 'Observation reported successfully', reportId: report.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

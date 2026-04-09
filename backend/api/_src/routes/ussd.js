const express = require('express');
const router = express.Router();
const prisma = require('../db');

/**
 * @api {post} /api/v1/ussd Mock Africa's Talking USSD Gateway (*347*PTS#)
 * @apiDescription Handles incoming USSD sessions from basic feature phones allowing offline querying.
 */
router.post('/', async (req, res) => {
    try {
        const { sessionId, serviceCode, phoneNumber, text } = req.body;
        let response = '';

        // "text" contains the user's sequential input separated by '*'
        // e.g., "" means first dial. "1" means user chose option 1. "1*358..." means they entered IMEI.
        const inputArray = text ? text.split('*') : [];

        if (text === '') {
            // Initial Menu
            response = `CON Welcome to PTS Sentinel Recovery\n1. Check Phone Status\n2. Report Phone Stolen\n3. Exit`;
        } else if (inputArray[0] === '1') {
            // Check Phone Status Flow
            if (inputArray.length === 1) {
                response = `CON Please enter the 15-digit IMEI number:`;
            } else if (inputArray.length === 2) {
                const imei = inputArray[1];
                if (imei.length !== 15) {
                    response = `END Error: IMEI must be 15 digits.`;
                } else {
                    const device = await prisma.device.findUnique({ where: { imei } });
                    if (!device) {
                        response = `END IMEI ${imei} is not registered in the National PTS Database. Do not buy.`;
                    } else if (device.status === 'CLEAN') {
                        response = `END Verified! ${device.brand} ${device.model} is CLEAN and safe to purchase.`;
                    } else {
                        response = `END DANGER! ${device.brand} ${device.model} is flagged as ${device.status}. Buying this is a crime.`;
                    }
                }
            }
        } else if (inputArray[0] === '2') {
            // Report Stolen Flow (Simplified)
            if (inputArray.length === 1) {
                response = `CON Enter the 15-digit IMEI of the stolen phone:`;
            } else if (inputArray.length === 2) {
                const imei = inputArray[1];
                // In a real app we'd trigger a 2FA call or OTP to the registered fallback number
                response = `END Incident logged for ${imei} from ${phoneNumber}. Police have been notified. IMEI is now blacklisted.`;

                await prisma.device.updateMany({
                    where: { imei, status: 'CLEAN' },
                    data: { status: 'STOLEN', riskScore: 100 }
                }).catch(() => { }); // ignore errors silently for mock
            }
        } else if (inputArray[0] === '3') {
            response = `END Thank you for using PTS. Stay safe.`;
        } else {
            response = `END Invalid choice. Session terminated.`;
        }

        // Africa's Talking API expects raw text response starting with CON (Continue) or END (End)
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } catch (error) {
        console.error('USSD Gateway Error:', error);
        res.set('Content-Type', 'text/plain');
        res.send('END An internal error occurred. Please try again later.');
    }
});

module.exports = router;

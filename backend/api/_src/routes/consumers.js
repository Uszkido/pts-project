const express = require('express');
const router = express.Router();
const prisma = require('../db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'supersecret_pts_dev_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                devices: {
                    include: {
                        certificates: {
                            where: { isActive: true }
                        },
                        incidents: {
                            orderBy: { createdAt: 'desc' }
                        },
                        observationReports: {
                            orderBy: { createdAt: 'desc' },
                            take: 10
                        }
                    }
                },
                purchases: {
                    where: { status: 'PENDING' },
                    include: {
                        device: true,
                        seller: { select: { email: true, companyName: true } }
                    }
                }
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const pastTransfers = await prisma.ownershipTransfer.findMany({
            where: { sellerId: req.user.id, status: 'COMPLETED' },
            include: {
                device: true,
                buyer: { select: { email: true, companyName: true } }
            },
            orderBy: { transferDate: 'desc' }
        });

        const pastDevices = pastTransfers.map(tx => ({
            ...tx.device,
            transferDetails: {
                date: tx.transferDate,
                buyer: tx.buyer
            }
        }));

        res.json({ devices: user.devices, pendingTransfers: user.purchases, pastDevices, fullName: user.fullName, email: user.email });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/messages', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { receiverId: req.user.id },
                    { receiverRole: 'ALL' },
                    { receiverRole: user.role }
                ]
            },
            include: { sender: { select: { email: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

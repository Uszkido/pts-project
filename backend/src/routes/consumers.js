const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
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
        res.json({ devices: user.devices, pendingTransfers: user.purchases });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

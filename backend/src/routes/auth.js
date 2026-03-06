const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

router.post('/register', async (req, res) => {
    try {
        const { email, password, companyName, role, fullName, nationalId, facialDataUrl, biodataUrl, cacCertificateUrl, businessAddress, shopLatitude, shopLongitude, shopPhotoUrl, businessRegNo } = req.body;

        // Simple validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const finalRole = role === 'CONSUMER' ? 'CONSUMER' : 'VENDOR';

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                companyName: finalRole === 'VENDOR' ? companyName : null,
                role: finalRole,
                fullName,
                nationalId,
                facialDataUrl,
                biodataUrl,
                cacCertificateUrl: finalRole === 'VENDOR' ? cacCertificateUrl : null,
                businessAddress: finalRole === 'VENDOR' ? businessAddress : null,
                shopLatitude: finalRole === 'VENDOR' && shopLatitude ? parseFloat(shopLatitude) : null,
                shopLongitude: finalRole === 'VENDOR' && shopLongitude ? parseFloat(shopLongitude) : null,
                shopPhotoUrl: finalRole === 'VENDOR' ? shopPhotoUrl : null,
                businessRegNo: finalRole === 'VENDOR' ? businessRegNo : null,
                vendorStatus: finalRole === 'VENDOR' ? 'PENDING' : 'APPROVED'
            }
        });

        res.status(201).json({ message: finalRole === 'VENDOR' ? 'Vendor registration submitted. Awaiting admin approval.' : 'User registered successfully', userId: user.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

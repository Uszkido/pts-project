const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });

        try {
            // Check real-time user status
            const userId = decodedUser.userId || decodedUser.id;
            const dbUser = await prisma.user.findUnique({ where: { id: userId } });
            if (!dbUser) return res.status(401).json({ error: 'Unauthorized: User not found' });
            if (dbUser.status === 'SUSPENDED') {
                return res.status(403).json({ error: 'Your account has been suspended by the administrator.', accountSuspended: true });
            }

            req.user = dbUser;
            next();
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
};

module.exports = authenticateToken;

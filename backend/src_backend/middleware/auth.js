const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = 'supersecret_pts_dev_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
        if (err) return res.sendStatus(403);

        try {
            // Check real-time user status
            const dbUser = await prisma.user.findUnique({ where: { id: decodedUser.id } });
            if (!dbUser) return res.sendStatus(401);
            if (dbUser.status === 'SUSPENDED') {
                return res.status(403).json({ error: 'Your account has been suspended by the administrator.', accountSuspended: true });
            }

            req.user = dbUser;
            next();
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });
};

module.exports = authenticateToken;

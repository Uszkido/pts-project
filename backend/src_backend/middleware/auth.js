const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
        // Normalize the user object so both user.id and user.userId work
        req.user = {
            ...user,
            id: user.id || user.userId
        };
        next();
    });
};

const authorize = (...roles) => {
    const allowedRoles = roles.flat();
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: `Forbidden: ${allowedRoles.join(' or ')} role required` });
        }
        next();
    };
};

const authenticateToken = authenticate;

module.exports = { authenticate, authenticateToken, authorize };

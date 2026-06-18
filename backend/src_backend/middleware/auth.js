const jwt = require('jsonwebtoken');

// Fail hard at startup if JWT_SECRET is missing or weak in production
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET environment variable is not set. Server cannot start securely.');
    process.exit(1);
}

if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET is too short for production. Use at least 32 random characters.');
    process.exit(1);
}

/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches the decoded payload to req.user.
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            const message = err.name === 'TokenExpiredError'
                ? 'Forbidden: Token has expired'
                : 'Forbidden: Invalid token';
            return res.status(403).json({ error: message });
        }

        req.user = {
            id: decoded.id || decoded.userId,
            role: decoded.role,
        };
        next();
    });
};

/**
 * Role-based access guard. Use after authenticate().
 * Example: router.get('/admin', authenticate, authorize('ADMIN'), handler)
 */
const authorize = (...roles) => {
    const allowedRoles = roles.flat();
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Forbidden: ${allowedRoles.join(' or ')} role required`,
            });
        }
        next();
    };
};

// Alias for backward compatibility
const authenticateToken = authenticate;

module.exports = { authenticate, authenticateToken, authorize, JWT_SECRET };

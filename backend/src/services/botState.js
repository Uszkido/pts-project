const userSessions = new Map();

// Helper to get or create a session
const getSession = (platform, userId) => {
    const key = `${platform}_${userId}`;
    if (!userSessions.has(key)) {
        userSessions.set(key, { state: 'IDLE', data: {} });
    }
    return userSessions.get(key);
};

// Helper to update session state
const updateSession = (platform, userId, state, dataStr = {}) => {
    const key = `${platform}_${userId}`;
    const session = getSession(platform, userId);
    session.state = state;
    if (dataStr) {
        session.data = { ...session.data, ...dataStr };
    }
    userSessions.set(key, session);
    return session;
};

// Helper to clear session
const clearSession = (platform, userId) => {
    const key = `${platform}_${userId}`;
    userSessions.delete(key);
};

module.exports = {
    getSession,
    updateSession,
    clearSession
};

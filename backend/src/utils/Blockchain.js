const crypto = require('crypto');

/**
 * Seals a transaction entry with a cryptographic hash.
 * Follows the simplified Blockchain-Style: hash = SHA256(prevHash + action + metadata + timestamp)
 */
const sealTransaction = (prevHash, actionType, metadata, timestamp) => {
    const data = `${prevHash || '0'}|${actionType}|${JSON.stringify(metadata)}|${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Verifies the integrity of a transaction chain.
 */
const verifyChainIntegrity = (history) => {
    let currentHash = '0';
    for (const tx of history) {
        const metadata = tx.metadata ? JSON.parse(tx.metadata) : {};
        const expectedHash = sealTransaction(metadata.prevHash || '0', tx.type, metadata.data || {}, tx.createdAt);

        if (tx.hash && tx.hash !== expectedHash) {
            return { valid: false, tamperedId: tx.id };
        }
    }
    return { valid: true };
};

module.exports = { sealTransaction, verifyChainIntegrity };

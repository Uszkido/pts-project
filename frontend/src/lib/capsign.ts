/**
 * PTS CapSign — Cryptographic Asset Signature
 * 
 * Generates a unique, verifiable digital signature for any PTS document
 * based on device data and transaction timestamps.
 */

export async function generateCapSign(data: {
    imei: string;
    holder?: string;
    timestamp: number;
    type: 'CERTIFICATE' | 'RECEIPT' | 'DOSSIER' | 'VERIFICATION';
}): Promise<string> {
    const rawString = `${data.type}|${data.imei}|${data.holder || 'PTS-AUTH'}|${data.timestamp}`;

    // Generate SHA-256 hash using Web Crypto API
    const msgUint8 = new TextEncoder().encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Format like a government security seal (8-4-4-4-12)
    // Example: VXL-XXXX-XXXX-XXXX-XXXXXXXXXXXX
    const prefix = 'VXL-';
    const s1 = hashHex.slice(0, 8);
    const s2 = hashHex.slice(8, 12);
    const s3 = hashHex.slice(12, 16);
    const s4 = hashHex.slice(16, 20);
    const s5 = hashHex.slice(20, 32);

    return `${prefix}${s1}-${s2}-${s3}-${s4}-${s5}`;
}

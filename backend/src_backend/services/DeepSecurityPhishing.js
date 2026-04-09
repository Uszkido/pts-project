/**
 * PTS Vexel Offline Phishing & Zero-Trust Engine
 * Inspired by Sublime Security Architecture & NLP Phishing detection
 * Analyzes messages locally without relying on external generative APIs.
 */

const SUSPICIOUS_DOMAINS = [
    "bit.ly", "tinyurl.com", "ngrok.io", "free-money", "bvn-update", "ptssentinel-verify.com"
];

const SCAM_KEYWORDS = {
    URGENT: ["urgent", "immediate action required", "account suspended", "blocked", "termination"],
    FINANCIAL: ["bvn", "nin", "atm pin", "cvv", "upgrade your account", "transfer"],
    AUTHORITY_SPOOFING: ["central bank", "cbn", "npf", "police", "efcc", "pts sentinel admin"]
};

// Calculates term probability for Nigerian specific scams
const calculateThreatScore = (message) => {
    const text = message.toLowerCase();
    let score = 0;
    const matchedVectors = [];

    // 1. Sublime Security Style Domain Heuristics
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];

    urls.forEach(url => {
        if (SUSPICIOUS_DOMAINS.some(domain => url.includes(domain))) {
            score += 40;
            matchedVectors.push("high-risk_obfuscated_url");
        }
        // General suspicious IP addresses
        if (url.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)) {
            score += 35;
            matchedVectors.push("raw_ip_address_link");
        }
    });

    // 2. Behavioral Keywords (Naive Bayesian logic emulation)
    let hasUrgency = false;
    SCAM_KEYWORDS.URGENT.forEach(kw => {
        if (text.includes(kw)) {
            score += 20;
            hasUrgency = true;
            if (!matchedVectors.includes("urgency_manipulation")) matchedVectors.push("urgency_manipulation");
        }
    });

    SCAM_KEYWORDS.FINANCIAL.forEach(kw => {
        if (text.includes(kw)) {
            score += 25;
            if (!matchedVectors.includes("financial_data_request")) matchedVectors.push("financial_data_request");
        }
    });

    SCAM_KEYWORDS.AUTHORITY_SPOOFING.forEach(kw => {
        if (text.includes(kw)) {
            score += 30;
            if (!matchedVectors.includes("authority_impersonation")) matchedVectors.push("authority_impersonation");
        }
    });

    // 3. BlackEye / Phishing Page Payload Detection
    if (text.includes("login") && hasUrgency && urls.length > 0) {
        score += 30; // Highly indicative of a credential harvesting page (BlackEye emulation)
        matchedVectors.push("credential_harvesting_pattern");
    }

    return {
        score: Math.min(score, 100),
        vectors: matchedVectors
    };
};

const analyzePhishingMessageOffline = (messageText) => {
    if (!messageText) return { isScam: false, confidence: 0, warning: "Safe", action: "NONE" };

    const analysis = calculateThreatScore(messageText);

    if (analysis.score >= 60) {
        return {
            isScam: true,
            confidence: analysis.score,
            scamType: analysis.vectors.join(", "),
            warning: "CRITICAL: This message matches profiles of known Nigerian SMS credential phishing.",
            action: "BLOCK_AND_REPORT"
        };
    } else if (analysis.score >= 30) {
        return {
            isScam: true,
            confidence: analysis.score,
            scamType: analysis.vectors.length > 0 ? analysis.vectors[0] : "suspicious_request",
            warning: "WARNING: Message contains suspicious financial or urgent requests.",
            action: "QUARANTINE"
        };
    } else {
        return {
            isScam: false,
            confidence: analysis.score,
            scamType: "none",
            warning: "Message appears safe.",
            action: "ALLOW"
        };
    }
};

module.exports = {
    analyzePhishingMessageOffline
};

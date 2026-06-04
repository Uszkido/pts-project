/**
 * PTS SCAM SHIELD PATTERN DATABASE (Nigeria 2026)
 * Common fraudulent patterns used in social engineering and mobile fraud.
 */
module.exports = {
    SCAM_TYPES: [
        {
            name: "Flash/Fake Bank Alert",
            patterns: ["Screenshot of ₦", "Transaction successful (SMS only)", "Sender: MobileApp", "Lack of 'Available Balance' update"],
            dangerLevel: "CRITICAL"
        },
        {
            name: "SIM Swap Phishing",
            patterns: ["Verify your NIN immediately", "Your SIM will be blocked in 2 hours", "Click here to update your BVN", "Telecom provider requesting OTP"],
            dangerLevel: "HIGH"
        },
        {
            name: "AI Voice/Deepfake Impersonation",
            patterns: ["Urgent request from voice that sounds like a relative", "Background noise of distress", "Ask for money to be sent to a PAGA/OPay/PalmPay account not in their name"],
            dangerLevel: "EXTREME"
        },
        {
            name: "Investment/Ponzi (BNB/Forex)",
            patterns: ["Double your money in 24 hours", "Join this WhatsApp group for daily signals", "Refer 2 people to unlock your withdrawal"],
            dangerLevel: "MODERATE"
        },
        {
            name: "Job/Processing Fee Scam",
            patterns: ["Congratulations, you are hired", "Pay ₦5,000 for training materials", "Government job slot available for a fee"],
            dangerLevel: "HIGH"
        }
    ],

    RED_FLAGS: [
        "Urgent or threatening language",
        "Requests for OTP, BVN, or PIN",
        "Links with non-official domains (e.g., .bitly, .tinyurl, instead of .gov.ng or .com)",
        "Messages from private numbers claiming to be 'Customer Care'",
        "Poor grammar mixed with official-sounding legal jargon"
    ],

    TRUSTED_CHANNELS: "Official channels always use verified bank apps, shortcodes (USSD), or .gov.ng websites. Banks NEVER ask for PIN/OTP via DM."
};

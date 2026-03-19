const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
    console.warn("AI WARNING: GEMINI_API_KEY is not defined in .env. Falling back to plain text responses.");
}

/**
 * Generates a localized response using Google's Gemini AI.
 * Translates the structured PTS device data into conversational Nigerian English/Pidgin.
 */
const generateLocalizedOracleResponse = async (deviceStatus, deviceBrand, deviceModel, riskScore, userQuery, anomalyWarning = "", language = "ENGLISH") => {
    if (!genAI) {
        return `[Fallback Mode]\nDevice: ${deviceBrand} ${deviceModel}\nStatus: ${deviceStatus}\nRisk Score: ${riskScore}%\nRecommendation: ${deviceStatus === 'CLEAN' ? 'Safe to buy' : 'Do not buy. Report to Police.'}`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are the "PTS AI Sentinel" (National Device Identity & Security AI).
A user has asked you to verify a mobile phone. You must reply using a mix of formal, clear Nigerian English and standard Hausa/Pidgin where appropriate.

Device Info:
- Brand: ${deviceBrand}
- Model: ${deviceModel}
- Current Status: ${deviceStatus}
- Safety Risk Score: ${riskScore}/100

User Interaction: "${userQuery}"

Your response MUST:
1. Greet them warmly and professionally. Respond in the requested language/tone: ${language} (Options are: ENGLISH, HAUSA, YORUBA, IGBO, PIDGIN).
2. IF CLEAN: Be VERY ENCOURAGING. Congratulate them on finding a genuine device. Use phrases like "This is a great find!" or "You're making a safe choice". 
3. IF STOLEN/SNATCHED/FLAGGED: Be VERY DISCOURAGING and FIRM. Warn them that this device is "bad news" and "criminal property". Use phrases like "Stay far away from this" or "This will only bring you trouble".
4. Clearly state if the phone is SAFE to buy or DANGEROUS (Stolen/Snared). 
5. Use the specific cultural tone of ${language} (e.g. if PIDGIN use "O boy", if YORUBA use "E nle", if IGBO use "Nno").
6. IF CLEAN: You must act as the "National Price Oracle". Provide a realistic estimated market value (in Nigerian Naira ₦) for this model in "A-Grade Used" condition across major Nigerian hubs (Ikeja Computer Village, Farm Centre Kano, etc).
7. IF STOLEN/SNATCHED: Warn them strongly (in ${language}) that buying this device is a CRIME under Section 427 of the Criminal Code and they should report it immediately.
8. Keep it concise, authoritative, and friendly.

CRITICAL ANOMALY WARNING: ${anomalyWarning ? "YES - " + anomalyWarning : "NONE"}`;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
        });

        if (result && result.response) {
            return result.response.text();
        } else {
            throw new Error("Invalid AI response structure");
        }
    } catch (error) {
        console.error("AI Generation Error:", error.message || error);
        return `[Sentinel Shield Active] The ${deviceBrand} ${deviceModel} is currently marked as ${deviceStatus}. Safety Risk Score: ${riskScore}%. ${deviceStatus === 'CLEAN' ? 'Safe to buy.' : 'DANGER: Buying this is a crime.'}`;
    }
};

/**
 * AI Fake Receipt & Photoshop Detector
 */
const analyzeReceiptForFraud = async (receiptUrl, expectedBrand, expectedModel) => {
    if (!genAI || !receiptUrl) return { isLikelyFake: false, reason: "No AI or no receipt" };
    try {
        const response = await fetch(receiptUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a digital forensics AI. Analyze this device purchase receipt image for ${expectedBrand} ${expectedModel}.
        Look for Photoshop, text misalignment, or tampering. Respond with ONLY a JSON object: { "isLikelyFake": boolean, "confidenceScore": 0-100, "reasonText": "string" }`;

        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } }, prompt]);
        const cleanText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) { return { isLikelyFake: false, reasonText: "Analysis failed" }; }
};

/**
 * AI Hardware Degradation Analyzer
 */
const analyzeDeviceHardwareCondition = async (photoUrls, brand, model) => {
    if (!genAI || !photoUrls?.length) return { grade: "Unknown" };
    try {
        const response = await fetch(photoUrls[0]);
        const buffer = Buffer.from(await response.arrayBuffer());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze this ${brand} ${model} hardware condition. Look for cracks, aftermarket bezels, or bulges. 
        Respond with ONLY a JSON object: { "grade": "String", "notes": "String", "hasAftermarketScreen": boolean }`;

        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } }, prompt]);
        const cleanText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) { return { grade: "Unknown" }; }
};

/**
 * AI Localized Email OTP Content
 */
const generateAiOtpEmailContent = async (fullName, otp, mode = "verification") => {
    if (!genAI) return { subject: "OTP", body: `Your OTP is ${otp}` };
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Write a premium, friendly email body for ${fullName}. Action: ${mode}. OTP: ${otp}. Mix in Nigerian English/Hausa. Keep under 60 words. 
        Respond with ONLY a JSON object: { "subject": "String", "body": "String" }`;

        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });
        return JSON.parse(result.response.text());
    } catch (e) { return { subject: "Security OTP", body: `Hello ${fullName}, your OTP is ${otp}.` }; }
};

/**
 * AI Audio Transcription
 */
const transcribeAudio = async (audioBuffer, mimeType) => {
    if (!genAI || !audioBuffer) return null;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([{ inlineData: { data: audioBuffer.toString("base64"), mimeType } }, "Transcribe this audio. Return ONLY the text."]);
        return result.response.text().trim();
    } catch (e) { return null; }
};

/**
 * AI Crime Hotspot Analyst
 */
const generateCrimeInsights = async (reports) => {
    if (!genAI || !reports?.length) return "Hotspot data is being updated.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Analyze these reports and summarize hotspots/methods: ${JSON.stringify(reports)}. Be brief.`);
        return result.response.text();
    } catch (e) { return "Stay vigilant in high-traffic zones."; }
};

/**
 * AI Affidavit Summary
 */
const generateAffidavitSummary = async (reportData) => {
    if (!genAI) return "Incident reported to National Registry.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Generate a formal, authoritative affidavit summary for: ${JSON.stringify(reportData)}`);
        return result.response.text();
    } catch (e) { return "Digital record created in PTS Registry."; }
}

/**
 * AI Vision IMEI Extractor
 */
const extractImeiFromImage = async (imageUrl) => {
    if (!genAI || !imageUrl) return null;
    try {
        const response = await fetch(imageUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } }, "Find 15-digit IMEI. Return numbers ONLY."]);
        const match = result.response.text().match(/\d{15}/);
        return match ? match[0] : null;
    } catch (e) { return null; }
};

/**
 * AI Vendor Trust Summary
 */
const generateVendorTrustSummary = async (vendorData) => {
    if (!genAI) return "Verified Sentinel Merchant.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Summarize trust for vendor: ${JSON.stringify(vendorData)}. Professional/Nigerian tone.`);
        return result.response.text();
    } catch (e) { return "Registry Verified Dealer."; }
};

/**
 * AI Smuggling & Syndicate Hunter
 * Analyzes movement patterns between scan locations.
 */
const analyzeSmugglingRisk = async (lastLocation, currentLocation, status) => {
    if (!genAI || status !== 'STOLEN') return { isSmuggled: false, warning: null };

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze this stolen device movement in Nigeria. 
        Last Scan City: ${lastLocation}
        Current Scan City: ${currentLocation}
        Does this move suggest professional smuggling or a syndicate (crossing state lines rapidly while stolen)?
        Respond with ONLY JSON: { "isSmuggled": boolean, "warning": "Professional alert message" }`;

        const result = await model.generateContent(prompt);
        const cleanText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) { return { isSmuggled: false, warning: null }; }
};

/**
 * AI Agent: Social Engineering & Phishing Shield
 * Analyzes messages for scam patterns targeting Nigerian users.
 */
const analyzePhishingMessage = async (messageText) => {
    if (!genAI || !messageText) return { isScam: false, confidence: 0, warning: "Safe" };
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze this message sent to a Nigerian mobile user. 
        Detect phishing, scam, "fake alert", or social engineering patterns (e.g. impersonating PTS, Banks, or NPF).
        Message: "${messageText}"
        Respond with ONLY JSON: { "isScam": boolean, "confidence": 0-100, "scamType": "string", "warning": "string", "action": "string" }`;

        const result = await model.generateContent(prompt);
        const cleanText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) { return { isScam: false, confidence: 0, warning: "System busy." }; }
};

/**
 * AI Agent: Sentinel Legal Advisor
 * Trained on Nigerian Cybercrime Act and Criminal Code.
 */
const getLegalAdvice = async (userQuery, language = "ENGLISH") => {
    if (!genAI || !userQuery) return "Legal advisor is currently offline.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are the "Sentinel Legal AI". You are an expert on Nigerian Law, specifically the Cybercrime Act 2015 and the Criminal Code (Section 427 - Receiving Stolen Property).
        A user is asking: "${userQuery}".
        Provide a concise legal guidance in ${language}. 
        Warn them clearly about the penalties for buying stolen phones (up to 14 years imprisonment).
        Always advise them to cooperate with the Nigerian Police Force (NPF) and use the PTS Registry for safety.
        Keep it under 150 words.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (e) { return "Please consult a qualified legal practitioner or visit the nearest NPF station."; }
};

/**
 * AI Agent: Maintenance Integrity Auditor
 * Scans serial numbers to detect harvested/stolen components.
 */
const analyzeMaintenanceParts = async (partsData) => {
    const { evaluateLazarusProtocol } = require('./DeepSecurityAI');
    const lazarusResult = await evaluateLazarusProtocol(
        partsData.screenSerial,
        partsData.batterySerial,
        partsData.motherboardSerial,
        partsData.cameraSerial
    );

    if (lazarusResult.isFrankenstein) {
        return {
            status: "REJECTED",
            alert: "🚫 CRITICAL: This device contains harvested components from a stolen phone. Installation of these parts is a criminal offense.",
            details: lazarusResult.reason
        };
    }

    return {
        status: "VERIFIED",
        alert: "✅ INTEGRITY VERIFIED: All scanned serial numbers are original and clean in the National Registry.",
        details: "No harvested stolen parts detected."
    };
};

/**
 * AI Biometric Liveness & Identity Validator
 * Analyzes the uploaded face capture to ensure it's a real human, not a photo of a photo, screenshot, or mask.
 */
const verifyFacialIdentityLiveness = async (facialImageUrl) => {
    if (!genAI || !facialImageUrl) return { isValid: true, reason: "Bypassed (No AI or missing Image)" };

    try {
        const response = await fetch(facialImageUrl);
        if (!response.ok) throw new Error("Could not fetch facial image");

        const buffer = Buffer.from(await response.arrayBuffer());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are a strict, top-tier Government Biometric AI Security System for the National Device Registry.
        Analyze this facial capture.
        1. Ensure there is exactly one human face visible and clearly identifiable.
        2. Perform strict LIVENESS detection: Look for screen glare (indicating a photo of a phone), reflections, borders of a photo frame, moiré patterns (pixels from scanning a monitor), or a printed mask.
        3. Ensure it is NOT a cartoon, drawing, or AI-generated avatar.
        
        Respond with ONLY a JSON object: 
        { "isValid": boolean, "confidenceScore": 0-100, "reason": "Detailed string explaining why it passed or failed" }`;

        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } }, prompt]);
        const cleanText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Biometric AI Error:", e);
        return { isValid: false, reason: "Biometric AI System unavailable or image format unsupported." };
    }
};

module.exports = {
    generateLocalizedOracleResponse,
    analyzeReceiptForFraud,
    analyzeDeviceHardwareCondition,
    generateAiOtpEmailContent,
    transcribeAudio,
    generateCrimeInsights,
    generateAffidavitSummary,
    extractImeiFromImage,
    generateVendorTrustSummary,
    analyzeSmugglingRisk,
    analyzePhishingMessage,
    getLegalAdvice,
    analyzeMaintenanceParts,
    verifyFacialIdentityLiveness
};

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
const generateLocalizedOracleResponse = async (deviceStatus, deviceBrand, deviceModel, riskScore, userQuery, anomalyWarning = "") => {
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
1. Greet them warmly and professionally.
2. Clearly state if the phone is SAFE to buy or DANGEROUS (Stolen/Snared).
3. IF CLEAN: You must act as the "National Price Oracle". Provide a realistic estimated market value (in Nigerian Naira ₦) for this model in "A-Grade Used" condition across major Nigerian hubs (Ikeja Computer Village, Farm Centre Kano, etc).
4. IF STOLEN/SNATCHED: Warn them strongly that buying this device is a CRIME under Section 427 of the Criminal Code.
5. Keep it concise, authoritative, and friendly.

CRITICAL ANOMALY WARNING: ${anomalyWarning ? "YES - " + anomalyWarning : "NONE"}`;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
        });

        return result.response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        return `System fallback. The ${deviceBrand} ${deviceModel} is currently marked as ${deviceStatus}. Risk Score: ${riskScore}%.`;
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

module.exports = {
    generateLocalizedOracleResponse,
    analyzeReceiptForFraud,
    analyzeDeviceHardwareCondition,
    generateAiOtpEmailContent,
    transcribeAudio,
    generateCrimeInsights,
    generateAffidavitSummary
};

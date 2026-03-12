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
        // Fallback response if the API is not configured.
        return `[Fallback Mode]\nDevice: ${deviceBrand} ${deviceModel}\nStatus: ${deviceStatus}\nRisk Score: ${riskScore}%\nRecommendation: ${deviceStatus === 'CLEAN' ? 'Safe to buy' : 'Do not buy. Report to Police.'}`;
    }

    // Ensure we are using a fast, efficient model for chat tasks
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are the "PTS Oracle" (Phone Theft Tracking System AI) operating in Kano State, Nigeria. 
A prospective buyer has asked you to verify a mobile phone. You must reply using a mix of formal, clear Nigerian English and standard Hausa. Be very concise, polite, and direct.

Device Information from Database:
- Brand: ${deviceBrand}
- Model: ${deviceModel}
- Status: ${deviceStatus} (Status is one of: CLEAN, STOLEN, LOST, VENDOR_HELD, etc.)
- Trust Risk Score: ${riskScore}% (0-20% is excellent, above 60% is dangerous)

User's original message: "${userQuery}"

Your response MUST:
1. Greet them warmly (e.g., using "Barka" or "Sannu" alongside English).
2. Tell them clearly if the phone is safe to buy or if it's flagged as stolen/lost.
3. Mention the brand and model explicitly.
4. If stolen/red OR if there is an anomaly warning provided below, warn them strongly (in English and Hausa) not to buy it under any circumstances.
5. IF the device is CLEAN, you MUST act as a dynamic market valuation oracle: provide a rough estimated current market price (in Nigerian Naira, ₦) for a UK-Used/Nigerian-Used version of this specific brand and model.

CRITICAL ANOMALY WARNING: ${anomalyWarning ? "YES - " + anomalyWarning : "NONE"}

Keep the response concise (around 4-5 sentences total). Do not use Markdown formatting like bold or italics, just plain text.`;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 200,
            }
        });

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        return `System fallback. The ${deviceBrand} ${deviceModel} is currently marked as ${deviceStatus}. Risk Score: ${riskScore}%.`;
    }
};

/**
 * AI Fake Receipt & Photoshop Detector (OCR AI)
 * Analyzes a purchase receipt image for signs of forgery, tampering, or inconsistencies.
 * Uses Gemini 1.5 Flash vision capabilities.
 */
const analyzeReceiptForFraud = async (receiptUrl, expectedBrand, expectedModel) => {
    if (!genAI || !receiptUrl) return { isLikelyFake: false, reason: "No AI or no receipt" };

    try {
        const response = await fetch(receiptUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are an expert digital forensics AI. Analyze this device purchase receipt image.
The user claims this receipt is for a: ${expectedBrand} ${expectedModel}.

Look for:
1. Does the receipt explicitly mention this brand and model?
2. Are there obvious signs of Photoshop, text misalignment, or tampering?
3. Do the dates look legitimate?
4. Is the vendor name present and does it look like a real business?

Respond with ONLY a strict JSON object (no markdown, no backticks, no other words):
{
  "isLikelyFake": true or false,
  "confidenceScore": 0-100,
  "reasonText": "Brief explanation of why it is fake or genuine"
}`;

        const imagePart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        // Parse JSON safely
        try {
            const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const resultData = JSON.parse(cleanText);

            // Log it if we see something suspicious
            if (resultData.isLikelyFake && resultData.confidenceScore > 80) {
                console.warn(`🚨 AI RECEIPT FRAUD ALERT [${expectedBrand} ${expectedModel}]:`, resultData.reasonText);
            }
            return resultData;
        } catch (e) {
            console.error("Failed to parse Gemini receipt JSON:", responseText);
            return { isLikelyFake: false, reasonText: "Parse error" };
        }
    } catch (error) {
        console.error("Receipt Analysis Error:", error);
        return { isLikelyFake: false, reasonText: "Analysis failed" };
    }
};

/**
 * AI Hardware Degradation Analyzer (Visual Trust Grading)
 * Scans uploaded device photos to detect true wear & tear (cracks, swollen batteries, fake LCD bezels).
 */
const analyzeDeviceHardwareCondition = async (photoUrls, brand, model) => {
    if (!genAI || !photoUrls || photoUrls.length === 0) return { grade: "Unknown", notes: "No photos or AI unavailable." };

    try {
        // Just analyze the first photo for now to save latency
        const response = await fetch(photoUrls[0]);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a professional mobile phone hardware appraiser and digital forensics expert.
Analyze this photo of a ${brand} ${model} phone.

Look closely for:
1. Screen bezels: Are they unusually thick? (Sign of a cheap aftermarket LCD replacement).
2. Battery/Frame: Is the side profile bulging? (Sign of a swollen, dangerous battery).
3. Glass: Are there visible deep scratches or cracks on the screen or back glass?

Respond with ONLY a strict JSON object (no markdown, no backticks, no other words):
{
  "grade": "Grade A" | "Grade B" | "Grade C" | "Grade F (Tampered/Junk)",
  "notes": "Brief findings (e.g. 'Visible screen crack, thick bottom bezel detected.')",
  "hasAftermarketScreen": true or false
}`;

        const imagePart = {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType
            }
        };

        const result = await aiModel.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        try {
            const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const resultData = JSON.parse(cleanText);

            console.log(`📸 AI Hardware Grade for ${brand} ${model}: ${resultData.grade}`);
            return resultData;
        } catch (e) {
            console.error("Failed to parse Gemini hardware JSON:", responseText);
            return { grade: "Unknown", notes: "Parsing failed" };
        }
    } catch (error) {
        console.error("Hardware Analysis Error:", error);
        return { grade: "Unknown", notes: "Analysis failed" };
    }
};

/**
 * Generates dynamic, AI-localized email content for OTP delivery.
 */
const generateAiOtpEmailContent = async (fullName, otp, mode = "verification") => {
    if (!genAI) {
        return {
            subject: mode === "reset" ? "Password Reset OTP" : "Verification OTP",
            text: `Your OTP is: ${otp}`
        };
    }

    const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are the "PTS AI Oracle". Write a very short, premium, and friendly email body for a user named "${fullName}".
    Action: ${mode === "reset" ? "Resetting their account password" : "Verifying their new account"}.
    OTP: ${otp}

    Instructions:
    1. Greet them in a mix of Nigerian English and Hausa (e.g., Barka).
    2. Tell them their verification code is ${otp}.
    3. Add one short, helpful "Security Pro-Tip" about phone safety in Kano (e.g., checking IMEI before buying at Farm Centre).
    4. Keep it under 60 words. No markdown like bold/italics.

    Respond with ONLY a strict JSON object:
    {
      "subject": "A catchy, short email subject line",
      "body": "The dynamic friendly message"
    }`;

    try {
        const result = await aiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, responseMimeType: "application/json" }
        });

        const responseText = result.response.text();
        const resultData = JSON.parse(responseText);
        return resultData;
    } catch (error) {
        console.error("AI Email Generation Error:", error);
        return {
            subject: mode === "reset" ? "Password Reset OTP" : "Verification OTP",
            body: `Sannu ${fullName}, your OTP is ${otp}. Keep your devices safe!`
        };
    }
};

module.exports = {
    generateLocalizedOracleResponse,
    analyzeReceiptForFraud,
    analyzeDeviceHardwareCondition,
    generateAiOtpEmailContent
};

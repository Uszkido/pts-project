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
const generateLocalizedOracleResponse = async (deviceStatus, deviceBrand, deviceModel, riskScore, userQuery) => {
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
3. Mention the brand and model.
4. If stolen/red, warn them strongly (in English and Hausa) not to buy it and that purchasing stolen property could lead to arrest.
Keep the response under 4 short sentences. Do not use Markdown formatting like bold or italics, just plain text.`;

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

module.exports = { generateLocalizedOracleResponse };

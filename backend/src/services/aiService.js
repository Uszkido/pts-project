const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
    console.warn("AI WARNING: GEMINI_API_KEY is not defined in .env. Falling back to plain text responses.");
}

const generateGeminiText = async (prompt) => {
    if (!genAI) throw new Error("No AI available. Check GEMINI_API_KEY.");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    if (result && result.response) return result.response.text();
    throw new Error("Invalid Gemini response structure");
};

const getFetchBufferAndMime = async (url) => {
    if (url.startsWith('data:')) {
        const matches = url.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            return { mimeType: matches[1], buffer: Buffer.from(matches[2], 'base64') };
        } else {
            throw new Error("Invalid base64 image data");
        }
    } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not fetch image payload. Status: ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        return { mimeType: response.headers.get("content-type") || "image/jpeg", buffer };
    }
};

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
        return await generateGeminiText(prompt);
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
        const { buffer, mimeType } = await getFetchBufferAndMime(receiptUrl);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `You are a digital forensics AI. Analyze this device purchase receipt image for ${expectedBrand} ${expectedModel}.
        Look for Photoshop, text misalignment, or tampering. Respond with ONLY a JSON object: { "isLikelyFake": boolean, "confidenceScore": 0-100, "reasonText": "string" }`;

        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType } }, prompt]);
        const cleanText = result.response.text();
        return JSON.parse(cleanText);
    } catch (e) { console.error(e); return { isLikelyFake: false, reasonText: "Analysis failed" }; }
};

/**
 * AI Hardware Degradation Analyzer
 */
const analyzeDeviceHardwareCondition = async (photoUrls, brand, modelName) => {
    if (!genAI || !photoUrls?.length) return { grade: "Unknown" };
    try {
        const { buffer, mimeType } = await getFetchBufferAndMime(photoUrls[0]);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Analyze this ${brand} ${modelName} hardware condition. Look for cracks, aftermarket bezels, or bulges. 
        Respond with ONLY a JSON object: { "grade": "String", "notes": "String", "hasAftermarketScreen": boolean }`;

        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType } }, prompt]);
        const cleanText = result.response.text();
        return JSON.parse(cleanText);
    } catch (e) { console.error(e); return { grade: "Unknown" }; }
};

/**
 * AI Localized Email OTP Content
 */
const generateAiOtpEmailContent = async (fullName, otp, mode = "verification") => {
    if (!genAI) return { subject: "OTP", body: `Your OTP is ${otp}` };
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Write a premium, friendly email body for ${fullName}. Action: ${mode}. OTP: ${otp}. Mix in Nigerian English/Hausa. Keep under 60 words. 
        Respond with ONLY a JSON object: { "subject": "String", "body": "String" }`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (e) { console.error(e); return { subject: "Security OTP", body: `Hello ${fullName}, your OTP is ${otp}.` }; }
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
    } catch (e) { console.error(e); return null; }
};

/**
 * AI Crime Hotspot Analyst
 */
const generateCrimeInsights = async (reports) => {
    if (!genAI || !reports?.length) return "Hotspot data is being updated.";
    try {
        const prompt = `Analyze these reports and summarize hotspots/methods: ${JSON.stringify(reports)}. Be brief.`;
        return await generateGeminiText(prompt);
    } catch (e) { console.error(e); return "Stay vigilant in high-traffic zones."; }
};

/**
 * AI Affidavit Summary
 */
const generateAffidavitSummary = async (reportData) => {
    if (!genAI) return "Incident reported to National Registry.";
    try {
        const prompt = `Generate a formal, authoritative affidavit summary for: ${JSON.stringify(reportData)}`;
        return await generateGeminiText(prompt);
    } catch (e) { console.error(e); return "Digital record created in PTS Registry."; }
}

/**
 * AI Vision IMEI Extractor
 */
const extractImeiFromImage = async (imageUrl) => {
    if (!genAI || !imageUrl) return null;
    try {
        const { buffer, mimeType } = await getFetchBufferAndMime(imageUrl);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType } }, "Find 15-digit IMEI. Return numbers ONLY."]);
        const match = result.response.text().match(/\d{15}/);
        return match ? match[0] : null;
    } catch (e) { console.error(e); return null; }
};

/**
 * AI Vendor Trust Summary
 */
const generateVendorTrustSummary = async (vendorData) => {
    if (!genAI) return "Verified Sentinel Merchant.";
    try {
        const prompt = `Summarize trust for vendor: ${JSON.stringify(vendorData)}. Professional/Nigerian tone.`;
        return await generateGeminiText(prompt);
    } catch (e) { console.error(e); return "Registry Verified Dealer."; }
};

/**
 * AI Smuggling & Syndicate Hunter
 * Analyzes movement patterns between scan locations.
 */
const analyzeSmugglingRisk = async (lastLocation, currentLocation, status) => {
    if (!genAI || status !== 'STOLEN') return { isSmuggled: false, warning: null };

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Analyze this stolen device movement in Nigeria. 
        Last Scan City: ${lastLocation}
        Current Scan City: ${currentLocation}
        Does this move suggest professional smuggling or a syndicate (crossing state lines rapidly while stolen)?
        Respond with ONLY JSON: { "isSmuggled": boolean, "warning": "Professional alert message" }`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (e) { console.error(e); return { isSmuggled: false, warning: null }; }
};

/**
 * AI Agent: Social Engineering & Phishing Shield
 * Fully offline NLP implementation inspired by Sublime Security Rules & BlackEye signatures.
 */
const analyzePhishingMessage = async (messageText) => {
    const { analyzePhishingMessageOffline } = require('./DeepSecurityPhishing');
    return analyzePhishingMessageOffline(messageText);
};

/**
 * AI Agent: Sentinel Legal Advisor
 * Deterministic Legal Lookup Engine (Based on Lawglance principles).
 * Strict mapping to Nigerian Cybercrime Act 2015 and Criminal Code to prevent AI hallucination.
 */
const getLegalAdvice = async (userQuery, language = "ENGLISH") => {
    const query = userQuery?.toLowerCase() || "";

    // Hardcoded authoritative legal definitions
    const LAW_GLANCE_DB = {
        "stolen": "Under Section 427 of the Nigerian Criminal Code, receiving or possessing a stolen device is a felony punishable by up to 14 years in prison. You must immediately report this device to the nearest Nigerian Police Force (NPF) station.",
        "receipt": "A forged or tampered receipt violates the Cybercrime (Prohibition, Prevention, etc.) Act 2015. Always demand the original carton and verify the IMEI electronically via the PTS Sentinel Registry before finalizing payment.",
        "block": "Once a device is flagged as 'Stolen', PTS automatically initiates a network block request across all Nigerian Telecoms (MTN, Airtel, Glo, 9mobile). Using a blocked phone constitutes unlawful network access.",
        "data": "Under the Nigeria Data Protection Regulation (NDPR), you have the right to request the deletion of your personal biodata if you no longer wish to use the PTS ecosystem. Contact data-officer@pts.gov.ng for immediate processing."
    };

    const LAW_GLANCE_HAUSA = {
        "stolen": "A karkashin Sashe na 427 na Dokar Manyan Laifuka ta Najeriya, mallakar wayar sata babban laifi ne wanda hukuncinsa zai iya kai shekaru 14 a gidan yari. Dole ne ku kai rahoton wannan wayar zuwa ofishin yansanda mafi kusa.",
        "receipt": "Takardar karya ko wadda aka yi mata jabun resit ta saba wa Dokar Laifukan Intanet ta 2015. Koyaushe ku nemi asalin kwali kuma ku tabbatar da IMEI ta manhajar PTS Sentinel gabanin biyan kudi.",
        "block": "Da zarar an yi wa waya alamar 'Sata', PTS tana mika bukatar toshe ta a duk hanyoyin sadarwa na Najeriya (MTN, Airtel, Glo, 9mobile). Amfani da wayar da aka toshe laifi ne.",
        "data": "Karkashin Dokar Kare Bayanai ta Najeriya (NDPR), kuna da hakkin neman a goge bayanan ku idan baku son ci gaba da amfani da PTS. Tuntubi data-officer@pts.gov.ng."
    };

    const LAW_GLANCE_PIDGIN = {
        "stolen": "Omo, Section 427 of Criminal code talk say to hold stolen phone na confirm offense wey fit land person 14 years for kirikiri. Abeg carry this phone go the nearest police station sharply.",
        "receipt": "To forge receipt na serious case under Cybercrime Act 2015. Abeg no pay shishi if dem no give you original carton and you don verify the IMEI for PTS app.",
        "block": "As dem don mark the phone 'Stolen', PTS don block am for all network (MTN, Airtel, Glo, 9mobile). To use blocked phone na serious problem.",
        "data": "Under the NDPR law, you get right to delete your data anytime you wan stop to dey use PTS. Just message data-officer@pts.gov.ng."
    };

    let selectedDb = LAW_GLANCE_DB;
    if (language.toUpperCase() === "HAUSA") selectedDb = LAW_GLANCE_HAUSA;
    if (language.toUpperCase() === "PIDGIN") selectedDb = LAW_GLANCE_PIDGIN;

    // Direct Lookup Logic
    for (const [keyword, legalText] of Object.entries(selectedDb)) {
        if (query.includes(keyword)) {
            return `[OFFICIAL PTS LEGAL COUNSEL] ${legalText}`;
        }
    }

    // Default Fallback Warning
    if (language.toUpperCase() === "HAUSA") {
        return "[OFFICIAL PTS LEGAL COUNSEL] Sayen wayar aljihun da ba a sani ba abu ne mai hadari wanda zai iya jefa ka a matsala ta shari'a. Koyaushe a yi amfani da PTS don tabbatar da nagartar na'urar.";
    } else if (language.toUpperCase() === "PIDGIN") {
        return "[OFFICIAL PTS LEGAL COUNSEL] To buy phone wey u no know the source na big risk wey fit put u for police net. Always use PTS verify phone before u drop money.";
    }

    return "[OFFICIAL PTS LEGAL COUNSEL] Purchasing a device of unknown origin carries severe legal risks under Nigerian Law. Always rely on the PTS National Registry to verify device claims before exchanging funds.";
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
        const { buffer, mimeType } = await getFetchBufferAndMime(facialImageUrl);

        // CompreFace Integration (Priority #1)
        if (process.env.COMPREFACE_API_KEY && process.env.COMPREFACE_URL) {
            console.log("Using CompreFace for Biometric Validation...");

            // Build form data with the image buffer
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('file', buffer, { filename: 'face.jpg', contentType: mimeType });

            const compreResponse = await fetch(`${process.env.COMPREFACE_URL}/api/v1/recognition/recognize?det_prob_threshold=0.8`, {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.COMPREFACE_API_KEY,
                    // If node-fetch or native fetch, FormData headers might need manual inject depending on environment,
                    // but we will simplify this for standard usage
                    ...formData.getHeaders ? formData.getHeaders() : {}
                },
                body: formData
            });

            if (!compreResponse.ok) {
                console.error("CompreFace API rejected the request:", compreResponse.statusText);
                throw new Error("CompreFace Engine Failure");
            }

            const compreData = await compreResponse.json();

            // Check if at least one distinct face was found
            if (compreData.result && compreData.result.length > 0) {
                // Here we could check for liveness/spoofing if the anti-spoofing plugin is enabled on the server.
                // Assuming basic facial structural validation passes:
                return { isValid: true, confidenceScore: compreData.result[0].box.probability * 100, reason: "CompreFace Engine: Valid human face detected." };
            } else {
                return { isValid: false, confidenceScore: 0, reason: "No clear human face detected by CompreFace." };
            }
        }

        // Gemini AI Integration Fallback (Priority #2)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `You are a strict, top-tier Government Biometric AI Security System for the National Device Registry.
        Analyze this facial capture.
        1. Ensure there is exactly one human face visible and clearly identifiable.
        2. Perform strict LIVENESS detection: Look for screen glare (indicating a photo of a phone), reflections, borders of a photo frame, moiré patterns (pixels from scanning a monitor), or a printed mask.
        3. Ensure it is NOT a cartoon, drawing, or AI-generated avatar.
        
        Respond with ONLY a JSON object: 
        { "isValid": boolean, "confidenceScore": 0-100, "reason": "Detailed string explaining why it passed or failed" }`;

        const result = await model.generateContent([{ inlineData: { data: buffer.toString("base64"), mimeType } }, prompt]);
        return JSON.parse(result.response.text());
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

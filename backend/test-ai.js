require('dotenv').config({ path: __dirname + '/.env' });
const { generateLocalizedOracleResponse } = require('./src/services/aiService');

async function testAI() {
    console.log("Testing Gemini API Connection...");
    try {
        const response = await generateLocalizedOracleResponse(
            'CLEAN',
            'Apple',
            'iPhone 15 Pro',
            95,
            'is this phone safe?',
            '',
            'PIDGIN'
        );
        console.log("AI Response Success!");
        console.log("-------------------");
        console.log(response);
        console.log("-------------------");
    } catch (error) {
        console.error("AI Response Failed:", error);
    }
}

testAI();

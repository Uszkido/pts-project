require('dotenv').config();
const nodemailer = require('nodemailer');
const { generateAiOtpEmailContent } = require('./src/services/aiService');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function runTest() {
    const targetEmail = "uszkido@icloud.com";
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`🤖 Step 1: Generating Personalized AI content for ${targetEmail}...`);
    try {
        const aiContent = await generateAiOtpEmailContent("Usman Kido", otp, "verification");
        console.log(`📜 AI Message Drafted: "${aiContent.body.substring(0, 50)}..."`);

        console.log(`📧 Step 2: Sending Secure SMTP Email to ${targetEmail}...`);
        const mailOptions = {
            from: `"PTS AI Oracle" <${process.env.EMAIL_USER}>`,
            to: targetEmail,
            subject: aiContent.subject,
            text: aiContent.body,
            html: `<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 30px; border-radius: 12px; max-width: 600px; margin: auto; background-color: #ffffff; color: #333; text-align: center;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #2e7d32; font-size: 28px; margin: 0;">🇳🇬 PTS AI Oracle</h1>
                        <p style="color: #666; font-size: 14px; margin: 5px 0;">Sovereign Device Security System</p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 5px solid #2e7d32; margin-bottom: 20px;">
                        <p style="font-size: 16px; line-height: 1.6; color: #444; margin: 0; text-align: left;">${aiContent.body}</p>
                    </div>
                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="font-size: 14px; color: #2e7d32; margin: 0;"><b>Never share this code with anyone.</b> Authorities will never ask for your OTP.</p>
                    </div>
                    <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">🛡️ Managed by National Device Integrity Registry Nigeria</p>
                   </div>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ SUCCESS! Email accepted by iCloud servers.`);
        console.log(`📝 Message ID: ${info.messageId}`);
    } catch (err) {
        console.error(`🛑 CRITICAL ERROR:`, err);
    }
}

runTest();

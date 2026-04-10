require('dotenv').config({ path: './.env' });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function testEmail() {
    console.log(`📡 Testing SMTP for ${process.env.EMAIL_USER}...`);
    try {
        await transporter.verify();
        console.log('✅ SMTP Connection is valid!');

        const mailOptions = {
            from: `"Test PTS" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: 'SMTP Test - PTS',
            text: 'This is a test email to verify the SMTP configuration.'
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully:', result.messageId);
    } catch (error) {
        console.error('❌ SMTP Test Failed:', error);
    }
}

testEmail();

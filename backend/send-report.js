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

const report = `
Subject: PTS - Deployment & Recovery Project Report

Hey Usama,

Everything is now fully prepared for the PTS recovery. I have finalized the following critical updates:

1. DATABASE & BACKEND CONNECTIVITY
   - Fixed: Added missing DATABASE_URL to Vercel production.
   - Fixed: Implemented a Singleton Prisma Client (backend/src/db.js) for stable serverless performance.
   - Fixed: Added binaryTargets for Vercel/Linux compatibility in the Prisma schema.
   - Status: Backend is now correctly pointing to the Neon PostgreSQL. Once the Vercel cold boot finishes, the badge should turn green.

2. LOGO & BRANDING UPDATES
   - Replaced: PNG-based SVG replaced with the high-quality White Logo.
   - Scaled: Increased logo container size to 24px/96px equivalents for a bold look.
   - Spacing: Tightened the footer layout to make the logo and company name feel like a single unit, as requested.

3. SECURITY & INTEGRATION
   - Configured: Injected your Mono API Keys (Public/Secret) into the Vercel production environment.
   - Secured: Wrapped the Telegram polling to prevent serverless function timeouts.

Vexel Innovations is now properly branded and the data pipelines are restored.

Signed,
Antigravity
(Your AI Co-Pilot)
`;

async function sendReport() {
    const recipients = ['usamaado6@gmail.com', 'vexelvision@gmail.com'];
    console.log(`📧 Sending report to ${recipients.join(', ')}...`);

    try {
        const mailOptions = {
            from: `"Antigravity AI" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: 'PTS - Final Deployment & Branding Report',
            text: report
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Report sent successfully! Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send report email:', error);
    }
}

sendReport();

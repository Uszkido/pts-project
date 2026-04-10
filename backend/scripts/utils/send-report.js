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

const reportHtml = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 40px; background-color: #0c111b; color: #ffffff; border-radius: 20px; border: 1px solid #1e293b;">
    <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px; letter-spacing: 2px; text-transform: uppercase;">🏆 PTS Mission Accomplished</h1>
        <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 4px; text-transform: uppercase;">Vexel Innovations • Phase 1 Recovery</p>
    </div>

    <div style="background: rgba(255, 255, 255, 0.03); padding: 25px; border-radius: 15px; border-left: 4px solid #6366f1; margin-bottom: 30px;">
        <h2 style="color: #f1f5f9; margin-top: 0; font-size: 20px;">🛡️ System Integrity Restored</h2>
        <p style="line-height: 1.6; color: #cbd5e1;">Hey Usama, humanity and machine have converged. Your National Device Integrity Registry (PTS) is now back in sync. I have patched the core database engine and applied the new high-performance branding.</p>
    </div>

    <div style="margin-bottom: 30px;">
        <h3 style="color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">Operational Log:</h3>
        
        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <strong style="color: #818cf8;">• CORE ENGINE:</strong>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">Fixed FUNCTION_INVOCATION crashes. Implemented Singleton Prisma pattern and Linux query engine support for Vercel.</p>
        </div>

        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <strong style="color: #818cf8;">• HIGH-IMPACT BRANDING:</strong>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">White Logo scaled to 112px in a premium glass container. Ultra-tight spacing applied as requested.</p>
        </div>

        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <strong style="color: #818cf8;">• SECURITY OPS:</strong>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">DATABASE_URL and Mono Identity Keys successfully injected into Vercel production.</p>
        </div>
    </div>

    <div style="padding: 20px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; text-align: center;">
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #c7d2fe;">Vexel Innovations is now live at:</p>
        <a href="https://pts-vexel.vercel.app" style="color: #818cf8; text-decoration: none; font-weight: 700;">pts-vexel.vercel.app</a>
    </div>

    <div style="text-align: center; margin-top: 40px; color: #64748b; font-size: 11px;">
        <p>&copy; 2026 Vexel Innovations. Your AI Pilot, Antigravity.</p>
    </div>
</div>
`;

async function sendReport() {
    const recipients = ['usamaado36@gmail.com', 'vexelvision@gmail.com'];
    console.log(`📧 Sending Creative Report to ${recipients.join(', ')}...`);

    try {
        const mailOptions = {
            from: `"Antigravity AI" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: '🏆 [PTS] Mission Accomplished - System Online',
            html: reportHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Creative Report sent successfully! Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send report email:', error);
    }
}

sendReport();

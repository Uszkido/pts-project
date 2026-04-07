/**
 * PTS SENTINEL: DEPLOYMENT SUMMARY DISPATCHER
 * Run this to email the master deployment bundle to the team.
 */
const nodemailer = require('nodemailer');

// ---------------------------------------------------------
// 🚨 PASTE CREDENTIALS HERE FOR LOCAL DISPATCH:
const EMAIL_USER = 'vexelvision@gmail.com';
const EMAIL_PASS = 'PASTE_YOUR_GMAIL_APP_PASSWORD_HERE'; // Replace with 16-char code
// ---------------------------------------------------------

const RECIPIENTS = ['vexelvision@gmail.com', 'usamaado36@gmail.com'];

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

const mailOptions = {
    from: `"PTS Sovereign Admin" <${EMAIL_USER}>`,
    to: RECIPIENTS.join(', '),
    subject: '🚀 PTS Sentinel: Sovereign Deployment & Stakeholder Bundle (2026)',
    html: `
        <div style="font-family: sans-serif; max-width: 600px; line-height: 1.6; color: #333;">
            <h2 style="color: #10b981;">PTS Sentinel: Deployment Sovereign Summary</h2>
            <p>Everything is now fully synchronized and <strong>Investor-Ready</strong>.</p>
            
            <hr style="border: 1px solid #eee;" />
            
            <h3 style="color: #2563eb;">🌍 Live Stakeholder Portals</h3>
            <ul>
                <li><strong>Main Landing / Public Verify:</strong> <a href="https://pts-vexel.vercel.app">pts-vexel.vercel.app</a></li>
                <li><strong>B2B Developer Hub:</strong> <a href="https://pts-vexel.vercel.app/developer">/developer</a></li>
                <li><strong>Law Enforcement Command:</strong> <a href="https://pts-vexel.vercel.app/police/login">/police/login</a></li>
                <li><strong>Merchant/Vendor Network:</strong> <a href="https://pts-vexel.vercel.app/vendor/login">/vendor/login</a></li>
                <li><strong>Consumer Dash:</strong> <a href="https://pts-vexel.vercel.app/consumer/login">/consumer/login</a></li>
            </ul>

            <h3 style="color: #7c3aed;">🔑 NCC Sovereign Sandbox (High-Limit)</h3>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; font-family: monospace; font-weight: bold; font-size: 14px;">
                pts_ncc_sandbox_c0bc9159451904beef383e8a8a11d986fa3cfbadf2f64cb6b73dc28525acf4a3
            </div>
            <p style="font-size: 12px; color: #666;">* Send this key to NCC for stress testing (1,000,000 call monthly quota).</p>

            <h3 style="color: #059669;">📊 Presentation Pitch Deck</h3>
            <p>The "Vexel Vision" printable proposal is updated with the new 2026 B2B Sovereign Gateways and stats.</p>
            <p><strong>Local Path:</strong> <code>pts/PTS_Proposal_Printable.html</code></p>

            <h3 style="color: #ea580c;">💰 Monetization & Quota Systems</h3>
            <ul>
                <li><strong>Free Trial:</strong> 500 calls/month (fair usage)</li>
                <li><strong>Billing:</strong> Pay-As-You-Go with Paystack Integration</li>
                <li><strong>Enterprise:</strong> Dedicated NCC/Telecom Hooks (Q3 2026)</li>
            </ul>

            <hr style="border: 1px solid #eee;" />
            
            <p style="font-size: 11px; text-align: center; color: #999;">
                &copy; 2026 Vexel Innovations. Confidential & Proprietary.
            </p>
        </div>
    `
};

async function sendSummary() {
    console.log('--- PTS SENTINEL: DISPATCHING DEPLOYMENT SUMMARY ---');
    try {
        if (EMAIL_PASS === 'PASTE_YOUR_GMAIL_APP_PASSWORD_HERE') {
            throw new Error('❌ You must provide your Gmail App Password in the script first.');
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ MASTER BUNDLE EMAILED SUCCESSFULLY!');
        console.log('Message ID:', info.messageId);
        console.log('Sent to:', RECIPIENTS.join(', '));
    } catch (error) {
        console.error('\n❌ FAILED to send email:', error.message);
        console.log('\n--- RECOMMENDATION ---');
        console.log('1. Go to your Vercel Dashboard and set EMAIL_USER and EMAIL_PASS.');
        console.log('2. Or, paste your 16-char Google App Password in this script locally.');
    }
}

sendSummary();

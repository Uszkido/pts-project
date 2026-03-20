require('dotenv').config({ path: './.env' });
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Read the pitch HTML file
const pitchHtmlPath = path.join(__dirname, '..', 'PTS_Proposal_Printable.html');
const pitchHtml = fs.readFileSync(pitchHtmlPath, 'utf-8');

// Email wrapper to make it render well in mail clients
const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#020817;font-family:'Segoe UI',sans-serif;">

  <!-- Email Header Banner -->
  <div style="background:linear-gradient(135deg,#020817 0%,#0a1628 100%);border-bottom:2px solid #10b981;padding:40px 32px;text-align:center;">
    <div style="font-size:11px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:4px;margin-bottom:12px;">🇳🇬 Confidential — Vexel Innovations</div>
    <h1 style="font-size:36px;font-weight:900;color:#ffffff;margin:0 0 8px 0;letter-spacing:-1px;">Police Tracking System</h1>
    <p style="font-size:15px;color:#64748b;margin:0;font-weight:500;">Investor & Government Pitch Deck · March 2026</p>
  </div>

  <!-- Intro Message -->
  <div style="background:#0f172a;padding:36px 32px;border-bottom:1px solid #1e293b;">
    <p style="color:#94a3b8;font-size:15px;line-height:1.8;margin:0 0 20px 0;">
      Please find below the <strong style="color:#ffffff;">full PTS pitch deck</strong> — covering the national device theft crisis, our platform solution, stakeholder portals, AI capabilities, projected impact, technology stack, and growth roadmap.
    </p>
    <p style="color:#94a3b8;font-size:15px;line-height:1.8;margin:0 0 24px 0;">
      The live platform is accessible at:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://pts-vexel.vercel.app" style="background:#10b981;color:#000000;font-weight:800;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:10px;display:inline-block;text-transform:uppercase;letter-spacing:2px;">
        🚀 View Live Platform
      </a>
      &nbsp;&nbsp;
      <a href="https://pts-vexel.vercel.app/pitch" style="background:#1e293b;color:#94a3b8;font-weight:700;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:10px;display:inline-block;text-transform:uppercase;letter-spacing:2px;border:1px solid #334155;">
        📊 View Online Pitch
      </a>
    </div>
  </div>

  <!-- Quick Stats Strip -->
  <div style="background:#020817;display:flex;border-bottom:1px solid #1e293b;overflow:hidden;">
    <div style="flex:1;padding:24px 20px;text-align:center;border-right:1px solid #1e293b;">
      <div style="font-size:28px;font-weight:900;color:#10b981;">₦2.1B+</div>
      <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Annual Loss</div>
    </div>
    <div style="flex:1;padding:24px 20px;text-align:center;border-right:1px solid #1e293b;">
      <div style="font-size:28px;font-weight:900;color:#10b981;">500+</div>
      <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Stolen/Day</div>
    </div>
    <div style="flex:1;padding:24px 20px;text-align:center;border-right:1px solid #1e293b;">
      <div style="font-size:28px;font-weight:900;color:#10b981;">5</div>
      <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Portals Live</div>
    </div>
    <div style="flex:1;padding:24px 20px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#10b981;">73%</div>
      <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Crime Reduction</div>
    </div>
  </div>

  <!-- Divider -->
  <div style="background:#0a0a0a;padding:20px 32px;text-align:center;border-bottom:1px solid #1e293b;">
    <div style="font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:4px;">— Full Pitch Deck Below —</div>
  </div>

  <!-- THE ACTUAL PITCH DECK CONTENT -->
  ${pitchHtml.replace(/<html.*?>[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*?<\/html>/, '')}

  <!-- Footer -->
  <div style="background:#020817;padding:32px;text-align:center;border-top:1px solid #1e293b;">
    <div style="font-size:18px;font-weight:900;color:#ffffff;margin-bottom:8px;">VEXEL <span style="color:#10b981;">Innovations</span></div>
    <div style="font-size:12px;color:#334155;margin-bottom:16px;">© 2026 Vexel Innovations — Police Tracking System (PTS)</div>
    <div style="font-size:11px;color:#1e293b;">This message is confidential and intended solely for the named recipients.</div>
  </div>

</body>
</html>
`;

async function sendPitchEmail() {
    const recipients = [
        'usamaado36@gmail.com',
        'uszkido@icloud.com',
        'vexelvision@gmail.com'
    ];

    console.log(`\n📧 Dispatching PTS Pitch Deck to ${recipients.length} recipients...`);
    console.log(`   → ${recipients.join('\n   → ')}\n`);

    try {
        const info = await transporter.sendMail({
            from: `"Vexel Innovations — PTS" <${process.env.EMAIL_USER}>`,
            to: recipients.join(', '),
            subject: '🇳🇬 [PTS] Police Tracking System — Investor & Government Pitch Deck 2026',
            html: emailHtml,
        });

        console.log('✅ Pitch deck sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Accepted: ${info.accepted?.join(', ')}`);
        if (info.rejected?.length) {
            console.log(`   ⚠ Rejected: ${info.rejected.join(', ')}`);
        }
    } catch (error) {
        console.error('❌ Failed to send pitch email:', error.message);
        process.exit(1);
    }
}

sendPitchEmail();

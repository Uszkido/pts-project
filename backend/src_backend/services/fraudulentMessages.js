/**
 * PTS FRAUDULENT MESSAGE DATASET (Nigeria 2026)
 * Real-world samples of phishing and social engineering messages for AI comparison.
 */
module.exports = {
    FAKE_BANK_ALERTS: [
        {
            bank: "Generic / Spoofed",
            content: "Acct: 002******451 \nAmt: NGN 150,000.00 CR \nDesc: TRF/FRM/CHUKWUMA... \nDate: 05-Jun-2026 14:02 \nBal: NGN 1,240,500.21",
            redFlags: ["Missing 'Available Balance'", "Sent from private number", "Incorrect date format"]
        },
        {
            bank: "Spoofed Shortcode",
            content: "Credit Alert! Amt: 50,000.00. Acc: 302***1102. Time: 12:45. From: JOSHUA. TNX for patronage. Val: 55,000.",
            redFlags: ["Informal language 'TNX'", "Lack of official bank header", "Sent via SMS-to-Web portal"]
        }
    ],

    PHISHING_NIN_BVN: [
        {
            type: "NIN SIM Linkage",
            content: "Dear Customer, your SIM will be DISCONNECTED tomorrow due to unlinked NIN. Click https://nimc-portal-gov-ng.live to update now and avoid N20,000 fine.",
            redFlags: ["Urgency", "Incorrect domain (.live instead of .gov.ng)", "Threat of fine"]
        },
        {
            type: "BVN Verification",
            content: "CBN Alert: Your BVN has been flagged for suspicious activity. To avoid account freeze, call the CBN Helpdesk on 08123456789 immediately. Do not ignore.",
            redFlags: ["Request to call private mobile number", "Threat of 'account freeze'", "CBN doesn't call customers directly"]
        }
    ],

    WHATSAPP_SCAMS: [
        {
            type: "OTP Hijack",
            content: "Hello, I mistakenly sent a 6-digit code to your phone. It was meant for my church group registration. Please read it to me so I can enter the meeting.",
            redFlags: ["Request for OTP", "Unexpected message from contact", "Emergency/Urgency"]
        },
        {
            type: "Financial Emergency (Borrowed Identity)",
            content: "O boy, I am at the hospital right now for emergency, my app is hanging. abeg borrow me 20k make I pay for treatment, I go send am back once I reach house.",
            redFlags: ["Requests for money via chat", "Refusal to take calls", "Mule account (OPay/PalmPay)"]
        }
    ],

    RECRUITMENT_SCAMS: [
        {
            type: "Fake Interview",
            content: "CONGRATS! You are shortlisted for interview at Vexel Logistics. Date: June 8, 9am. Venue: 12, Allen Ave, Ikeja. Come with ₦5,000 for documentation & ID card.",
            redFlags: ["Request for payment (Documentation fee)", "Unsolicited invite", "Vague company reputation"]
        },
        {
            type: "Remote Work Trap",
            content: "Earn ₦30k daily from home! All you need is your smartphone. We need 50 testers for our new app. Contact HR on WhatsApp: 09012345678 to start.",
            redFlags: ["Too good to be true salary", "WhatsApp-only recruitment", "Vague job description"]
        }
    ],

    INVESTMENT_GIVEAWAY: [
        {
            type: "Ponzi / Double Funds",
            content: "KIDO INVESTMENT: Turn ₦5,000 into ₦50,000 in 2 hours. 100% legit, regulated by SEC. No referral needed. Join link: bit.ly/kido-invest",
            redFlags: ["Unrealistic returns", "Bitly link", "Lack of official registration"]
        },
        {
            type: "Govt Palliatives",
            content: "Federal Govt ₦25,000 Cash Grant for all citizens is out! Check your eligibility and withdraw now: https://fg-cash-grant.online",
            redFlags: ["Suspicious URL", "Free money offer", "No official government announcement"]
        }
    ]
};

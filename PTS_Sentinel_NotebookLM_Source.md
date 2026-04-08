# PTS Sentinel: National Device Security & Identity Infrastructure
## Comprehensive Project Knowledge Base (v6.0)

### 1. Vision & Executive Summary 
The **PTS Sentinel** (Vexel AI) is a sovereign national digital infrastructure designed to eliminate mobile theft, fraud, and illegal device trafficking in Nigeria. It transforms the mobile phone from a simple gadget into a **Sentinel-Verified Digital Asset**.

---

### 2. Core AI Capabilities (The "Sentinel Brain")
The system utilizes **Google Gemini 1.5 Pro/Flash** for advanced cognitive tasks:

*   **National Price Oracle**: Provides real-time estimated market value (₦) for clean devices across hubs like Ikeja Computer Village and Farm Centre Kano.
*   **Vision AI Scan**: Zero-typing search. Scans photos of phone screens/boxes to extract 15-digit IMEIs using OCR.
*   **National Language Oracles**: Supports localized interactions in **English, Hausa, Yoruba, Igbo, and Pidgin**.
*   **Crime Hotspot Mapping**: Analyzes theft reports to identify and warn users about high-risk zones.
*   **Digital Affidavit Generator**: Automatically creates professional, legal-sounding incident summaries for police reporting.
*   **Voice Command Processing**: Transcribes and executes commands from voice messages (WhatsApp/Telegram).
*   **Hardware Appraisal AI**: Analyzes photos for physical degradation, aftermarket parts, or signs of a "Chop-Shop" (Frankenstein) rebuild.

---

### 3. Advanced Security Protocols
*   **Panic Protocol**: A one-click command that immediately flags ALL of a user’s registered devices as STOLEN across the national registry.
*   **Lazarus Protocol**: Detects "Chop-Shop" devices by cross-referencing internal hardware serial numbers (Screen, Battery, Motherboard).
*   **Syndicate/Smuggling Detector**: Flags devices that move rapidly between scan locations across state lines while marked as STOLEN.
*   **Safe-Hand Escrow Transfer**: A secure ownership movement protocol that requires verification from both seller and buyer, preventing ownership scams.

---

### 4. User Interaction (Omni-Channel Bots)
Users interact with the system primarily via **Telegram** and **WhatsApp**.

#### Key Commands:
| Command | Description |
| :--- | :--- |
| **`register`** | Multi-stage OTP-verified registration (Consumer or Vendor) |
| **`login`** | Authenticates user for secure actions |
| **`report`** | Flags a device as STOLEN and generates an AI Affidavit |
| **`panic`** | Immediate lockdown of all registered devices |
| **`transfer`** | Securely moves device ownership to another registered user |
| **`language`** | Switches Oracle tone (ENG, HAU, YOR, IGB, PID) |
| **`safety`** | Shows regional crime hotspots and safety insights |
| **`badge`** | (Vendors only) Generates an AI-verified Trust Badge |
| **[Photo]** | Triggers Vision AI IMEI Extraction |
| **[Voice]** | Triggers AI Voice Transcription |

---

### 5. Technical Architecture
*   **Backend**: Node.js / Express.
*   **Database**: PostgreSQL with Prisma ORM.
*   **Real-time Logic**: Telegram Bot API, WhatsApp Meta API.
*   **AI Layer**: Google Generative AI (Gemini SDK).
*   **Storage**: Cloudinary (Encrypted identity photos and device visuals).
*   **Deployment**: Vercel (Production Edge).

---

### 6. Summary of Master Features Implemented
1.  **OTP Enforcement**: Mandatory identity verification via email/SMS before account creation.
2.  **National Oracle**: Integrated price estimation to prevent scams.
3.  **Vision Search**: Image-to-IMEI processing for speed.
4.  **Localized Oracles**: Cultural tones for national adoption.
5.  **Panic Mode**: Instant security response.
6.  **Trust Badges**: Reputation systems for verified market vendors.

---
### 7. Deployment & Operations
The system is optimized for **Vercel** serverless deployment.

#### Deployment Prerequisites:
*   **Vercel CLI**: Ensure version 50+ is installed.
*   **Authentication**: If `vercel login` fails with "Method Not Allowed" on the device link, use the legacy authorization page: **[vercel.com/device](https://vercel.com/device)**.

#### Build Configuration:
*   **Backend**: Uses `@vercel/node` and Prisma. Requires `npx prisma generate` during the build step (`postinstall`).
*   **Frontend**: Next.js App Router with environment variables for API connection.

---
**PTS Sentinel: Securing the Digital Heart of Nigeria.**

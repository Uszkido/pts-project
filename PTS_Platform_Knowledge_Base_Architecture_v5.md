# 🏛️ PTS (Phone Theft Tracking System) | Platform Knowledge Base & Architecture
**Comprehensive Technical Authority & AI Grounding Document**  
**Project Owner**: Vexel Innovations  
**Version**: 5.0 (DeepSecurity AI Integration Edition)  
**Status**: Gold Master Archive

---

## 1. 📂 Core Mission & System Identity
The **Phone Theft Tracking System (PTS)** is a national-scale hardware intelligence infrastructure designed to create a verifiable, digital "Chain of Custody" for mobile devices. 

By tying unique device identifiers (**IMEI**) to verified user accounts via digital ownership certificates, PTS makes the resale of stolen devices impossible. The platform leverages advanced artificial intelligence and distributed network mechanics to enforce **market-wide rejection** of illicit property and secure point-of-sale verification.

---

## 2. 🧱 The Technological Pillars (Stack Architecture)
PTS is built on a modern, decoupled web architecture designed for 99.9% uptime, high-concurrency search capability, and real-time AI inference.

*   **⚡ Frontend (UI/UX)**: 
    *   **Framework**: Next.js 15+ (App Router).
    *   **Optimization**: Server-Side Rendering (SSR) and Edge compute for real-time dashboards with ISR for public verification endpoints.
    *   **Styling**: Modern Tailwind CSS (Dark Mode, Glassmorphism, tailored status alerts).
*   **⚙️ Backend (API Layer)**: 
    *   **Engine**: Node.js 22 (Express).
    *   **Logic**: RESTful API design. Endpoints secured via JWT (JSON Web Tokens).
    *   **Webhooks**: Real-time listeners for Meta Graph API (WhatsApp) and Telegram API.
*   **🧠 DeepSecurity AI Engine**:
    *   **LLM Core**: Google Gemini 1.5 Flash Vision capabilities for language, logic processing, and forensic OCR analysis.
*   **💾 Database (Ledger Tier)**: 
    *   **Engine**: PostgreSQL.
    *   **Interface**: Prisma ORM for schema-driven, type-safe database interactions.
    *   **Integrity**: ACID-compliant transactions ensure atomic ownership transfers and immutable audit logging.
*   **☁️ Deployment (CI/CD)**: 
    *   **Hosting**: Vercel (Serverless Functions Edge Network).

---

## 3. 🛡️ The "Evolutionary Echelons" (Strategic Roadmap)

### **Echelon I: Foundation (The Current Ledger)**
*   **Digital Certificates**: Issuance of active ownership tokens (DDOC) upon registration.
*   **Chain of Title**: Tracking the immutable history from Vendor -> Consumer -> Next Consumer.
*   **Risk Scoring**: A weighted algorithm (0-100) calculating the "Safety" of a device.
*   **Component DNA**: Logging internal serial numbers (Battery, Screen, Motherboard).

### **Echelon II: AI Sovereignty (The Current Active State)**
*   **WhatsApp & Telegram Oracles**: Localized AI bots speaking formal Nigerian English and Hausa, providing instant IMEI verification and market valuation to buyers on the street.
*   **DeepSecurity AI Suite**: Unprecedented layers of AI defense (See Section 6).
*   **Crowd-Sourced Recovery**: Silent proximity reports sent to Law Enforcement.

### **Echelon III: Sovereign Hardware Control (Future)**
*   **Kill-Switch API**: Official integration with Telecom providers to permanently "brick" hardware via MDM/Signal protocols.
*   **Automated Escrow**: Fully integrated smart-contract-style payments holding funds until cryptographic digital handover is confirmed.

---

## 4. 🗄️ Database Schema & Object Models
For AI Grounding: Key models extending `schema.prisma`.

| Model | Primary Use Case | Key Attributes |
| :--- | :--- | :--- |
| **`User`** | Identity Management | `email`, `role`, `vendorTier`, `facialDataUrl`. |
| **`Device`** | Asset Registry | `imei`, `serialNumber`, `status`, `riskScore`, internal parts serial numbers. |
| **`Certificate`** | Proof of Sovereignty | `qrHash`, `isActive`, `issueDate`. Links User and Device. |
| **`IncidentReport`** | Forensic Record | `type`, `location`, `policeReportNo`, `description`. |
| **`OwnershipTransfer`** | Escrow & Transfer | `sellerId`, `buyerId`, `handoverCode`, `isEscrowEnabled`, `escrowStatus`. |
| **`DeviceTrackingLog`** | Network Velocity | `deviceImei`, `method`, `location` (Network IP/Phone Number). |
| **`TransactionHistory`**| Immutable Audit Log | `actorId`, `type`, `description`, `metadata`. Every AI action is logged. |

---

## 5. 🧮 Core System Workflows

### **Workflow 1: Public IMEI Verification (The "Safe Search")**
1.  **Input**: Guest messages WhatsApp/Telegram Oracle or enters 15-digit IMEI on web.
2.  **Logic**: System queries `Device` ledger. Checks Fraud Engine for clone anomalies. 
3.  **Output**: AI translates the database result into Hausa/English. 
    *   If **Clean**: Generates real-time market Naira valuation. 
    *   If **Stolen/Cloned**: Generates high-alert police warning.

### **Workflow 2: Device Registration & QA**
1.  **Vendor** inputs IMEI and uploads photos and receipts.
2.  **AI OCR Intercept**: Gemini Vision scans the receipt for Photoshop artifacts.
3.  **AI Hardware Intercept**: Gemini Vision grades the physical phone photos for swollen batteries/cracked screens.
4.  **Lazarus Protocol Intercept**: Backend cross-references internal serials with known stolen devices.
5.  **Commit**: If passed, saves to DB and logs the AI Trust Grade to the device's permanent history.

### **Workflow 3: The Handover Protocol (P2P Sale)**
1.  **Seller** clicks "Transfer Device". 
2.  **Pattern of Life Check**: AI ensures the user's current IP matches their historical behavior to block account takeovers.
3.  **Authentication**: System generates a secure 6-digit **Handover Code**.
4.  **Execution**: Buyer enters code -> Atomic transfer of ownership and certificate generation.

### **Workflow 4: Reporting Theft**
1.  **Consumer** selects Device -> Submits Theft Report.
2.  **Logic**: `Device.status` flips to `STOLEN`.
3.  **Bloodhound Mode**: The device enters dynamic tracking state, predicting smuggling routes if moving fast.

---

## 6. 🧠 DeepSecurity AI Core Modules
PTS v5 represents a paradigm shift, utilizing specialized AI nodes to actively hunt organized crime.

| AI Protocol | Detection Target | Execution Logic |
| :--- | :--- | :--- |
| **AI Fake Receipt OCR** | Forged Documents | Uses Gemini Vision during device registration to detect mismatched dates, bad fonts, and tampered purchase receipts. Auto-blocks registration. |
| **Hardware Trust Grader**| Vendor Scams | Uses Gemini Vision to appraise device photos, seeking thick aftermarket screen bezels, and swollen batteries. Modifies device history with true hardware grade. |
| **The Lazarus Protocol**| "Frankenstein" Devices | Detects if a "Clean" phone is built from parts (screen, battery, motherboard) harvested from a globally blacklisted stolen device. Flags as Chop-Shop assembly. |
| **Cloned IMEI Fraud Engine**| "Flashed" Devices | Monitors verification velocity. If an IMEI is searched by 3+ different Telegram/WhatsApp accounts in 24 hours across different locations, it flags it as critically CLONED. |
| **Pattern of Life Lock**| Account Takeovers | If a thief compromises a PTS account to transfer ownership to themselves, the AI detects an anomalous IP geolocation history and blocks the transaction pending Live Selfie Verification. |
| **Syndicate Mapper**| Organized Crime Rings | Graph AI clusters Vendors operating from identical IP shadow-networks, automatically slashing their Trust Scores if widespread collusion is found. |
| **Digital Bloodhound**| Real-Time Pursuit | Aggressive tracking state machine. Flips a stolen device's tracker into rapid-ping mode if it detects high-velocity movement on cellular networks. |
| **Predictive Smuggling**| Border Extractions | Mathematical engine calculating velocity vectors. Autogenerates Customs Alerts if a stolen asset moves North at >60km/h towards international borders. |

---

## 7. 👮 Law Enforcement Intelligence (The Police Portal)
The Police instance of PTS provides forensic capabilities beyond standard user access:
*   **Syndicate Graphs**: Visualizing networks of proxy barrow boys working under a single cartel boss.
*   **Predictive Smuggling Alerts**: Direct feeds of imminent cross-border shipments.
*   **Area Heatmaps**: Visualizes theft "Hot Zones" based on incident report coordinates (`latitude`/`longitude`).

---

## 8. 🛡️ Security & Data Sovereignty
*   **Encryption**: All traffic is TLS 1.3. Passwords use **Bcrypt** (12 salt rounds).
*   **Auditability**: `TransactionHistory` is append-only. **No record is ever deleted**, preventing data-washing.
*   **AI Localization**: The system operates exclusively within the Nigerian cultural context, rejecting non-Nigerian communication vectors.

---
**Document Authority**: Vexel Innovations Engineering Core  
**Intended Use**: Core Grounding instruction manual for Neural LLMs, Notebooks, and AI-Assisted Development tools.

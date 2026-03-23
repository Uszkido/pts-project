# Vexel Innovations: Police Tracking System (PTS)
## Certified Technical Handover Document

**Date:** March 2026  
**Project:** PTS Decentralized Device Registry & Recovery Network  
**Developer AI:** Antigravity (Vexel Core)

---

### 1. Project Architecture Overview
The PTS system is designed as a high-security, distributed architecture ensuring resilient uptime and secure data transmission across nationwide checkpoints.

*   **Database Infrastructure:** Render-hosted PostgreSQL Database (`pts_db`).
*   **Backend API Server:** Node.js/Express with Prisma ORM deployed onto Render Web Services.
*   **Frontend Ecosystem:** Next.js (React 19) statically exported via Capacitor and Electron frameworks.
*   **Cryptography:** Implementation of **CapSign™** — an SHA-256 digital signature methodology for generating legally verifiable document hashes for PDFs.
*   **Alternative Environment:** A standalone, fully-converted MySQL codebase is available at `/pts-mysql`.

---

### 2. The Application Suite
The PTS ecosystem is divided into four distinct user interfaces to guarantee role-based access control and high security:

1.  **PTS Command Center (Admin)**
    *   **Platforms:** Web Portal, Native Windows Desktop App (`com.vexel.pts.command`)
    *   **Purpose:** Global surveillance, map-based tracking of all nationwide devices, system health monitoring, and total user account administration (adding/approving vendors).
2.  **PTS Sentinel (Law Enforcement)**
    *   **Platforms:** Web Portal, Android Mobile App, Windows Desktop App (`com.vexel.pts.sentinel`)
    *   **Purpose:** Mobile incident response, forensic dossier generation, flagging devices as "STOLEN," resolving bounty claims, and verifying vendor arrests.
3.  **PTS Merchant (Registered Vendors)**
    *   **Platforms:** Web Portal, Android Mobile App, Windows Desktop App (`com.vexel.pts.merchant`)
    *   **Purpose:** Scanning devices at the point of sale, checking IMEI safety status, creating Proof of Sales, and submitting suspicious alerts. Features a localized Offline Mode using IndexedDB for poor connectivity regions.
4.  **PTS Passport (Consumers / Citizens)**
    *   **Platforms:** Android Mobile App (`com.vexel.pts.passport`)
    *   **Purpose:** Publicly verifying device ownership, reporting device loss for automatic flagging, and maintaining a digital passport of owned assets.

---

### 3. Key Features & Technologies Configured

#### **Offline-Capable Scanner (PWA & Native)**
Implemented a dual-layer caching system using Service Workers and IndexedDB. Vendors in markets like Alaba or Computer Village with no internet access can continue to scan devices. Scans are hashed locally and synchronized sequentially with the live database when an internet connection is re-established.

#### **CapSign™ Digital Documentation**
Developed a custom module (`src/lib/capsign.ts`) that cryptographically hashes a device's IMEI + timestamp + transaction data to produce irreversible 64-character signatures. These are stamped directly into the generated `jsPDF` documents (Vendor Receipts, Police Reports) to prevent counterfeiting.

---

### 4. Hosting & Deployment Specifications

**Production Environment (Currently Live via Render):**
*   **API Base URL:** `https://pts-backend-40w4.onrender.com/api/v1`
*   **Frontend Portal:** *(Currently Localized / Statically Exported)*
*   **Environment Variables Configured:**
    *   `DATABASE_URL` / `DIRECT_URL` (PostgreSQL Connection Strings)
    *   `JWT_SECRET` (Secure 256-bit encryption key)
    *   `NEXT_PUBLIC_API_URL` (Frontend API Bridge)

**Local Developer Setup Instruction:**
1.  Navigate into `pts/backend`.
2.  Install dependencies: `npm install`.
3.  Load the schema: `npx prisma db push`.
4.  Start the master node: `npm start` (Runs on Port 5000).
5.  Navigate into `pts/frontend`.
6.  Start development server: `npm run dev` (Runs on Port 3000).

---

### 5. Final Delivery Verification Checklist
- [x] Backend Health Checks Passing (200 OK)
- [x] Prisma Database Connected
- [x] Android Builds Generated successfully for all three branches
- [x] Windows Desktop (`.exe`) Installers compiled successfully
- [x] Consumer, Admin, Police, and Vendor routing correctly split
- [x] MySQL secondary copy verified and compiled
- [x] Pitch Proposal generated and emailed directly to executive team

---
**Prepared For:** Usama Ado, CEO Vexel Innovations  
*End of Document*

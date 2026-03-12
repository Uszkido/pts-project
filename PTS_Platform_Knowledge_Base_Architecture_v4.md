# 🏛️ PTS (Phone Theft Tracking System) | Platform Knowledge Base & Architecture
**Comprehensive Technical Authority & AI Grounding Document**  
**Project Owner**: Vexel Innovations  
**Version**: 4.0 (Enhanced for NotebookLM)  
**Status**: Gold Master Archive

---

## 1. 📂 Core Mission & System Identity
The **Phone Theft Tracking System (PTS)** is a national-scale hardware intelligence infrastructure designed to create a verifiable, digital "Chain of Custody" for mobile devices. 

By tying unique device identifiers (**IMEI**) to verified user accounts via digital ownership certificates, PTS makes the resale of stolen devices impossible. The platform moves beyond simple GPS recovery, focusing on **market-wide rejection** of illicit property.

---

## 2. 🧱 The Technological Pillars (Stack Architecture)
PTS is built on a modern, decoupled web architecture designed for 99.9% uptime and high-concurrency search capability.

*   **⚡ Frontend (UI/UX)**: 
    *   **Framework**: Next.js 15+ (App Router).
    *   **Optimization**: Server-Side Rendering (SSR) for real-time dashboards and Incremental Static Regeneration (ISR) for the public IMEI verification landing pages.
    *   **Styling**: Custom Tailwind CSS implementation with "Vexel" design system (Dark Mode, Glassmorphism, high-contrast alerts).
*   **⚙️ Backend (API Layer)**: 
    *   **Engine**: Node.js 22 (Express).
    *   **Logic**: RESTful API design. Every endpoint is secured via Bearer tokens (JWT).
    *   **Media**: Cloudinary integration for forensic image handling (No local storage of sensitive media).
*   **💾 Database (Ledger Tier)**: 
    *   **Engine**: PostgreSQL.
    *   **Interface**: Prisma ORM (Object-Relational Mapping) for type-safe database interactions.
    *   **Integrity**: ACID-compliant transactions ensure that ownership transfers either succeed completely or fail gracefully, preventing "ghost" device ownership.
*   **☁️ Deployment (CI/CD)**: 
    *   **Hosting**: Vercel.
    *   **Edge Middleware**: Implements geo-blocking, rate-limiting, and security header injection at the network edge.

---

## 3. 🛡️ The "Evolutionary Echelons" (Strategic Roadmap)
PTS is deployed in phases to allow for technical stabilization and market adoption.

### **Echelon I: Foundation (The Current State)**
*   **Digital Certificates**: Issuance of active ownership tokens upon registration.
*   **Chain of Title**: Tracking the history from Vendor -> Consumer -> Next Consumer.
*   **Risk Scoring**: A weighted algorithm (0-100) that calculates the "Safety" of a device based on its reported status and incident flags.
*   **Component DNA**: Logging internal serial numbers (Battery, Screen, Motherboard) to prevent "Chop Shop" resale of parts.

### **Echelon II: Guardian Mesh (Active Connectivity)**
*   **Offline Tracking**: A decentralized mesh network allowing PTS-certified devices to detect the Bluetooth/WiFi signature of "HOT" (Stolen) phones.
*   **Crowd-Sourced Recovery**: Silent proximity reports sent to Law Enforcement without revealing the reporter's identity.
*   **Global Sync**: Integration with GSMA (International registry) and Interpol registries.

### **Echelon III: Sovereign Control (Total Lockdown)**
*   **Kill-Switch API**: Professional integration with Telecom providers to permanently "brick" hardware via MDM/Signal protocols.
*   **P2P Escrow**: Integrated payment holding. Funds only release to the seller once the digital IMEI handover is cryptographically confirmed.

---

## 4. 🗄️ Database Schema & Object Models
For AI Grounding: The following models represent the core entities in `schema.prisma`.

| Model | Primary Use Case | Key Attributes |
| :--- | :--- | :--- |
| **`User`** | Identity Management | `email`, `role` (ADMIN, POLICE, VENDOR, CONSUMER), `vendorTier`, `status`. |
| **`Device`** | Asset Registry | `imei`, `serialNumber`, `status` (CLEAN, STOLEN, LOST), `riskScore`, `isBricked`. |
| **`Certificate`** | Proof of Sovereignty | `qrHash`, `isActive`, `issueDate`. Links User and Device. |
| **`IncidentReport`** | Forensic Record | `type` (STOLEN, SNATCHED, FRAUD), `location`, `policeReportNo`, `evidenceUrls`. |
| **`Transfer`** | Ledger Logic | `sellerId`, `buyerId`, `handoverCode`, `status` (PENDING, COMPLETED). |
| **`History`** | Immutable Audit Log | `actorId`, `type`, `description`, `metadata`. Every change is logged here. |

---

## 5. 🔄 Core System Workflows

### **Workflow 1: Public IMEI Verification (The "Safe Search")**
1.  **Input**: Guest enters 15-digit IMEI.
2.  **Logic**: System queries `Device` and `IncidentReport` tables.
3.  **Output**: Returns `RiskScore`. 
    *   **0-20%**: Secure to purchase.
    *   **100%**: 🚨 **STOLEN DETECTED**. Police link provided.

### **Workflow 2: The Handover Protocol (P2P Sale)**
1.  **Seller** clicks "Transfer Device".
2.  **System** generates a secure 6-digit **Handover Code**.
3.  **Buyer** enters the code.
4.  **Backend Atomic Operation**:
    *   Deactivates Seller's `Certificate`.
    *   Reassigns `Device.ownerId` to the Buyer.
    *   Issues new `Certificate` to the Buyer.
    *   Writes record to `TransactionHistory`.

### **Workflow 3: Reporting Theft (The "Flag")**
1.  **Consumer** logs in -> Selects Device -> Submits Theft Report.
2.  **Logic**: `Device.status` flips to `STOLEN`.
3.  **Result**: The device is instantly blacklisted across the entire national vendor and police network.

---

## 6. 👮 Law Enforcement Intelligence (The Police Portal)
The Police instance of PTS provides forensic capabilities beyond standard user access:
*   **Suspect Tracking**: Links `IncidentReports` to `Suspect` profiles and known addresses.
*   **Device Passport**: Generates a tamper-proof PDF ledger of a device's entire lifecycle for court evidence.
*   **Area Heatmaps**: Visualizes theft "Hot Zones" based on incident report coordinates (`latitude`/`longitude`).
*   **Telemetry Logs**: Access to `DeviceTrackingLog` which tracks L1 (GPS), L2 (WiFi), and L3 (Witness) sighting levels.

---

## 7. 🛡️ Security & Data Sovereignty Protocol
*   **Encryption**: All traffic is TLS 1.3. Passwords use **Bcrypt** (12 salt rounds).
*   **Auditability**: `TransactionHistory` is append-only. No record is ever deleted, ensuring a permanent "Paper Trail" for every device.
*   **Handshake Security**: Possession of a device without the matching `Certificate` and active `HandoverCode` is flagged as an unauthorized possession.

---

## 8. 🚀 FAQ / Troubleshooting for Developers
*   **How are duplicate IMEIs handled?**: The system rejects duplicates at the database level (`unique` constraint). If a vendor attempts to register an existing IMEI, it triggers an "Ownership Dispute" workflow requiring physical proof.
*   **Can a CONSUMER see other users' devices?**: No. Row-level logic in the Express backend filters all device queries by the active `JWT.sub` (userId).
*   **What happens if a VENDOR is rogue?**: Admins can flag a vendor, setting their `status` to `SUSPENDED`. This instantly kills their API access and marks all devices they registered as "High Audit Risk."

---
**Document Authority**: Vexel Innovations Engineering Core  
**Intended Use**: Grounding document for AI-Assisted Architecture & Product Research.

# PTS Technical Deep-Dive | The "Everything" Guide

This document is designed to give you a 360-degree understanding of the **Phone Theft Tracking System (PTS)**. It covers every layer of the stack, from the user's screen to the secure server logs.

---

## 🏗️ 1. The Architectural Blueprint
PTS is built on a **Decoupled Architecture**. This means the Frontend (UI) and Backend (Logic) are separate, allowing for high security and performance.

### **Frontend: Next.js 15 (The Super-Framework)**
- **Why Next.js?** Unlike standard React, Next.js handles **Server-Side Rendering (SSR)**. This means the page is "pre-built" on the server before it reaches the user, making it extremely fast on mobile networks in Nigeria.
- **Vite/Turbopack**: We use modern build tools that bundle the code efficiently, reducing the "weight" of the website for faster loading.
- **Tailwind CSS Grid**: The sleek, dark-mode design is built using a custom grid system that is fully responsive (looks great on a cheap Android or a high-end MacBook).

### **Backend: Node.js & Express (The Logic Engine)**
- **Middleware Architecture**: Every request goes through a "Checkpoint." 
  - *Auth Middleware*: Checks the user's JWT token.
  - *Status Middleware*: If an admin suspends a user, this middleware catches them instantly and logs them out (it checks the `status` field in the database every time).
- **Multer & Cloudinary**: When a photo is uploaded, it doesn't touch our server's hard drive. It goes straight to **Cloudinary** (a global media cloud). This ensures our system stays lightweight and fast.

### **Database: PostgreSQL & Prisma (The Ledger)**
- **PostgreSQL**: A "Relational" database. This is critical because a Device *belongs* to a User, and an Incident *belongs* to a Device. PostgreSQL ensures these relationships never break.
- **Prisma Schema**: We define the system in a `schema.prisma` file. Prisma then generates a "Client" that lets the backend talk to the database in a language it understands perfectly.
- **Migrations**: Every time we change the database (like adding device photos), we use "Prisma Migrate." This keeps a history of all database changes, similar to how Git tracks code changes.

### **Intelligence Layer: Google Gemini AI**
- **Sovereign Intel**: Automated intelligence synthesis. Gemini analyzes raw database metrics (incidents, recoveries, fraud alerts) to generate a "National Commanders Briefing" for admins.
- **Hardware Appraisal**: Uses Vision AI to analyze device photos, detecting screen degradation or aftermarket parts with high precision.

### **Integrity Layer: Blockchain Hashing**
- **Immutable Ledger**: Every critical transaction (registration, handover, status change) is "sealed" using SHA-256 cryptographic hashing.
- **Chain of Custody**: The `TransactionHistory` now mimics a blockchain, where each entry is cryptographically linked, making forensic tampering impossible to hide.

---

## 🚀 2. Deployment & Vercel (The Hosting)
We use **Vercel** to host the PTS Frontend. Vercel is the industry standard for high-performance web apps.

- **CI/CD (Continuous Integration/Deployment)**: Every time we "commit" code to GitHub, Vercel automatically:
  1. Pulls the latest code.
  2. Runs a "Build" (checks for errors).
  3. Deploys it to a global network of servers (including edge servers close to Africa).
- **Environment Variables**: Sensitive data like the `DATABASE_URL` or `CLOUDINARY_SECRET` are never written in the code. They are stored securely in Vercel's secret manager, so even if someone sees the code, they can't access the private keys.

---

## 🔄 3. Deep-Dive Process: The "Stolen" Lifecycle
To understand the system, let's follow a single "Stolen Phone" event:

1. **User Action**: The Consumer clicks "Report Stolen" in their dashboard.
2. **Frontend Process**: Next.js sends a `POST` request to `/api/v1/incidents`.
3. **Backend Process**: 
   - Express verifies the User's token.
   - It checks if the User actually owns the device IMEI they are reporting.
   - It updates the `Device` status to `STOLEN`.
   - It creates a new `IncidentReport` and a `TransactionHistory` entry.
4. **Database Update**: The `status` field in the `Device` table flips from `CLEAN` to `STOLEN`.
5. **Real-Time Result**: Any Police officer or Vendor searching that IMEI will now see a **Red Warning** and a 100% Risk Score instantly.

---

## 🛠️ 4. Security Mechanics
- **JWT (JSON Web Tokens)**: When a user logs in, they get a token. If someone tries to "guess" a URL (like `/admin/dashboard`), the backend rejects them immediately because they lack the required "Admin" role in their token.
- **Bcrypt Hashing**: Passwords are never seen by human eyes. They are salted and hashed.
- **Row-Level Logic**: The code is written so a Consumer can *only* see devices where `ownerId === currentUserId`. They cannot "spy" on other people's phones.

---

## 🌍 5. Summary for Proposals
- **Next.js**: High performance and mobile-friendly.
- **Node.js/Express**: Scalable and secure API.
- **PostgreSQL/Prisma**: Reliable data ledger.
- **Vercel**: Global reach and zero-downtime deployments.
- **Cloudinary**: Secure forensic image management.
- **Google Gemini**: AI-powered intelligence and fraud detection.
- **Recharts**: High-performance cryptographic data visualization.

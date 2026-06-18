# 📱 PTS — Phone Theft Tracking System

> A decentralized digital authority for verifiable device ownership, tracking stolen devices and preventing the resale of stolen phones through immutable, IMEI-bound digital certificates.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://pts-frontend-ten.vercel.app)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js-black)](frontend)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)](backend)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748)](backend/prisma)

**🔗 [Live Demo](https://pts-vexel.vercel.app)** &nbsp;•&nbsp; **Built by [Usama Ado Shehu](https://github.com/Uszkido) — Vexel Innovations**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [System Architecture](#%EF%B8%8F-system-architecture)
- [Core User Roles](#-core-user-roles)
- [Database Schema](#%EF%B8%8F-database-schema)
- [Key Workflows](#-key-workflows)
- [Getting Started](#-getting-started)
- [Security](#%EF%B8%8F-security-mechanisms)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🧭 Overview

PTS gives every mobile device a verifiable digital identity. Vendors register devices at point of sale, ownership transfers are logged on an immutable chain of custody, and anyone — a buyer, a pawn shop, a police officer — can check an IMEI in seconds to see if it's clean or stolen.

| | |
|---|---|
| **Frontend** | Next.js (React) + TailwindCSS |
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL + Prisma ORM (Neon serverless) |
| **Mobile** | Capacitor / native Android & iOS agents |

---

## 🏗️ System Architecture

- **Frontend** — Public-facing IMEI verification, Law Enforcement login, Vendor Portal, and Device Owner dashboard.
- **Backend/API** — Handles authentication, dashboard logic, device registration, and ownership transfers.
- **Database** — PostgreSQL paired with Prisma ORM, hosted on Neon serverless.

## 👥 Core User Roles

### 1. Device Owner (`CONSUMER`)
Views digital certificates for owned devices and can flag a device as stolen directly from their dashboard.

### 2. Verified Vendor (`VENDOR`)
The point of registration. When a phone is sold, the vendor registers the IMEI and issues the first certificate of ownership to the buyer. Vendors carry a **Vendor Tier** trust score.

### 3. Law Enforcement (`POLICE`)
Administrative oversight to investigate flagged devices, review transaction histories, and confirm or clear stolen status across the registry.

---

## 🗄️ Database Schema

| Model | Purpose |
|---|---|
| **User** | All operators — `id`, `email`, `role` (ADMIN / VENDOR / CONSUMER / POLICE / INSURANCE / TELECOM), `vendorTier` |
| **Device** | Core tracked asset — `imei` (unique, 15-digit), `serialNumber`, `brand`, `model`, `status` (CLEAN / STOLEN / LOST / INVESTIGATING / VENDOR_HELD), `riskScore` (0–100) |
| **Certificate** | Proof of ownership — `deviceId`, `ownerId`, `qrHash` (unique, for physical scanning), `isActive` |
| **OwnershipTransfer / ProofOfSale** | Ledger of ownership changes — `sellerId`, `buyerId`, `status` (PENDING / COMPLETED / CANCELLED) |
| **IncidentReport** | Lost/stolen reports — `deviceId`, `reporterId`, `type` (LOST / STOLEN / SNATCHED / FRAUD), `policeReportNo`, `status` (OPEN / REVIEWING / RESOLVED) |
| **TransactionHistory** | Immutable audit log of every action taken on a device |

---

## 🔑 Key Workflows

### Safe Purchasing — Public Verification API
Anyone can enter a 15-digit IMEI on the PTS homepage. The system checks the `Device` and `IncidentReport` tables and returns a **Public Trust Index** score. Devices marked `STOLEN` trigger a clear warning before purchase.

### Chain of Custody
1. A **Vendor** registers a new device.
2. The Vendor transfers ownership to a **Consumer's** email address.
3. PTS issues a `Certificate` binding that Consumer to the device IMEI.
4. The transfer is permanently logged in `TransactionHistory`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- PostgreSQL database (or a [Neon](https://neon.tech) serverless instance)

### Backend setup
```bash
cd backend
npm install
cp .env.example .env      # add your DATABASE_URL and JWT secret
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend setup
```bash
cd frontend
npm install
cp .env.example .env.local   # point this at your backend URL
npm run dev
```

The app will be available at `http://localhost:3000`.

> **Note:** Replace the `.env.example` references above with your actual environment template filenames if they differ.

---

## 🛡️ Security Mechanisms

- Devices cannot be deleted directly — all changes flow through an auditable Transfer or Reporting workflow.
- Passwords are hashed with `bcrypt`.
- Backend routes are protected by JWT-based authentication.

---

## 🗺️ Roadmap

PTS is evolving from a registry into a full hardware-intelligence infrastructure — see [`ROADMAP.md`](ROADMAP.md) for the full plan, including the Device DNA Registry, Guardian Mesh Network, and Anti-Theft Kill-Switch API.

**Currently live:** Device DNA Registry · Naira (₦) currency integration · AI Command Center · Blockchain chain-of-custody.

---

## 🤝 Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before opening a PR.

## 🔒 Security Policy

Found a vulnerability? Please see [`SECURITY.md`](SECURITY.md) for responsible disclosure steps.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ in Nigeria by <a href="https://github.com/Uszkido">Usama Ado Shehu</a> — Vexel Innovations
</p>

# Phone Theft Tracking System (PTS)
**Created by**: Usama Ado Shehu | Vexel Innovations  
**Purpose**: A decentralized digital authority for verifiable device ownership, preventing the resale of stolen phones by creating immutable digital certificates tied to device IMEIs.

---

## 🏗️ System Architecture

The PTS is a modern web application designed for high security and verifiable transactions:
- **Frontend**: Next.js (React), TailwindCSS, custom UI components. Features public-facing IMEI verification, Law Enforcement login, Vendor Portal, and Device Owner dashboard.
- **Backend/API**: Node.js + Express handling authentication, dashboard logic, device registration, and ownership transfers.
- **Database**: PostgreSQL paired with Prisma ORM (currently hosted on Neon serverless).

## 👥 Core User Roles

The system natively supports a multi-stakeholder ecosystem:

### 1. Device Owner (Consumer)
- **Role Title**: `CONSUMER`
- **Capabilities**: Can log in to view the digital certificates of devices they own. If their device is stolen, they can flag it from their dashboard.

### 2. Verified Vendor
- **Role Title**: `VENDOR`
- **Capabilities**: Vendors act as the initial point of registration. When someone buys a phone, the vendor registers the IMEI and issues the first digital certificate of ownership to the buyer. Vendors have "Vendor Tiers" indicating their trust score and legitimacy.

### 3. Law Enforcement
- **Role Title**: `POLICE`
- **Capabilities**: Have administrative oversight to investigate flagged devices, track transaction histories, and formally mark recovered devices or confirm stolen status across the entire registry.

---

## 🗄️ Database Schema (Prisma Models)

The core operations of the application rely on this structured data model:

### `User`
Stores all operators in the system.
- `id`: UUID
- `email`: UNIQUE String
- `role`: String (ADMIN, VENDOR, CONSUMER, POLICE, INSURANCE, TELECOM)
- `vendorTier`: Int (Trust metric for vendors)
- *Relations*: Devices owned, Certificates held, Incident Reports submitted, Transaction Histories.

### `Device`
The core asset being tracked across its lifecycle.
- `imei`: UNIQUE String (15-digit international identifier)
- `serialNumber`: String
- `brand` & `model`: Strings
- `status`: String (CLEAN, STOLEN, LOST, INVESTIGATING, VENDOR_HELD)
- `riskScore`: Int (0-100 score on how trustworthy the device history is)
- *Relations*: Registered Owner (User), History, Certificates.

### `Certificate`
The digital proof of ownership, updated every time the device changes hands.
- `deviceId`: Relation to Device
- `ownerId`: Relation to User
- `qrHash`: UNIQUE String (For physical scanning/verification)
- `isActive`: Boolean

### `OwnershipTransfer` & `ProofOfSale`
The ledger mechanics handling when a device moves from one person/store to another.
- `sellerId` & `buyerId`: Relations to User.
- `status`: PENDING, COMPLETED, CANCELLED.
- Maintains strict chain-of-title.

### `IncidentReport`
Created when a phone is lost or stolen.
- `deviceId`: Relation to Device
- `reporterId`: Relation to User
- `type`: LOST, STOLEN, SNATCHED, FRAUD
- `policeReportNo`: String (Optional reference to real-world documentation)
- `status`: OPEN, REVIEWING, RESOLVED

### `TransactionHistory`
The immutable log. Every single action taken on a device (registration, selling, status change) is written here for auditing.

---

## 🔑 Key Workflows

### 1. Safe Purchasing (The Public Verification API)
Anyone can go to the PTS homepage and enter a 15-digit IMEI. The system scans the `Device` and `IncidentReport` tables. It generates a **Public Trust Index** risk score. If the device is marked as `STOLEN`, the user is warned not to purchase it.

### 2. The Chain of Custody
1. A **Vendor** logs in and registers a stack of new devices.
2. The Vendor transfers ownership of a device to a **Consumer's** email address.
3. The system generates a `Certificate` mapping that Consumer to the Device IMEI.
4. The transaction is permanently logged in `TransactionHistory`.

## 🛠️ Security Mechanisms
- Devices cannot simply be deleted; they must go through proper Transfer or Reporting workflows.
- Passwords are encrypted using `bcrypt`.
- Authentication uses secure JWT token validation on the Express backend before returning Dashboard data..

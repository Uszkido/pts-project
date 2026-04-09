-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VENDOR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "fullName" TEXT,
    "nationalId" TEXT,
    "companyName" TEXT,
    "facialDataUrl" TEXT,
    "biodataUrl" TEXT,
    "cacCertificateUrl" TEXT,
    "businessAddress" TEXT,
    "shopLatitude" DOUBLE PRECISION,
    "shopLongitude" DOUBLE PRECISION,
    "shopPhotoUrl" TEXT,
    "businessRegNo" TEXT,
    "vendorStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "vendorTier" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phoneNumber" TEXT,
    "address" TEXT,
    "isEmailConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationOtp" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newPasswordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "otp" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "serialNumber" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLEAN',
    "riskScore" INTEGER NOT NULL DEFAULT 100,
    "lastKnownLocation" TEXT,
    "lastKnownIp" TEXT,
    "lastLocationUpdate" TIMESTAMP(3),
    "registeredOwnerId" TEXT NOT NULL,
    "devicePhotos" TEXT[],
    "purchaseReceiptUrl" TEXT,
    "cartonPhotoUrl" TEXT,
    "isLocationShared" BOOLEAN NOT NULL DEFAULT false,
    "screenSerialNumber" TEXT,
    "batterySerialNumber" TEXT,
    "motherboardSerialNumber" TEXT,
    "cameraSerialNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorTrustScore" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "completedSales" INTEGER NOT NULL DEFAULT 0,
    "flaggedDevices" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelecomSyncLog" (
    "id" TEXT NOT NULL,
    "telecomName" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsSent" INTEGER NOT NULL,

    CONSTRAINT "TelecomSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "policeReportNo" TEXT,
    "evidenceUrls" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "locationSharedWithOwner" BOOLEAN NOT NULL DEFAULT false,
    "suspectId" TEXT,
    "bounty" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSuspiciousAlert" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sellerEmail" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSuspiciousAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qrHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "handoverCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" TEXT,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionHistory" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfSale" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "buyerId" TEXT,
    "transactionRef" TEXT,
    "signedByVendor" BOOLEAN NOT NULL DEFAULT false,
    "signedByBuyer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofOfSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suspect" (
    "id" TEXT NOT NULL,
    "fullName" TEXT,
    "alias" TEXT,
    "nationalId" TEXT,
    "phoneNumber" TEXT,
    "description" TEXT,
    "photoUrl" TEXT,
    "knownAddresses" TEXT,
    "dangerLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceTrackingLog" (
    "id" TEXT NOT NULL,
    "deviceImei" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "accuracy" TEXT,
    "ipAddress" TEXT,
    "metadata" TEXT,
    "loggedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceTrackingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverRole" TEXT,
    "receiverId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceType" TEXT,
    "description" TEXT NOT NULL,
    "partsReplaced" TEXT,
    "cost" DOUBLE PRECISION,
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_imei_key" ON "Device"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "VendorTrustScore_vendorId_key" ON "VendorTrustScore"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_qrHash_key" ON "Certificate"("qrHash");

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_registeredOwnerId_fkey" FOREIGN KEY ("registeredOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTrustScore" ADD CONSTRAINT "VendorTrustScore_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_suspectId_fkey" FOREIGN KEY ("suspectId") REFERENCES "Suspect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSuspiciousAlert" ADD CONSTRAINT "VendorSuspiciousAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSuspiciousAlert" ADD CONSTRAINT "VendorSuspiciousAlert_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionHistory" ADD CONSTRAINT "TransactionHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionHistory" ADD CONSTRAINT "TransactionHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfSale" ADD CONSTRAINT "ProofOfSale_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfSale" ADD CONSTRAINT "ProofOfSale_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfSale" ADD CONSTRAINT "ProofOfSale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

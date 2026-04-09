-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "isBricked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastBluetoothSig" TEXT,
ADD COLUMN     "lastObservationDate" TIMESTAMP(3),
ADD COLUMN     "lastWifiSig" TEXT;

-- AlterTable
ALTER TABLE "OwnershipTransfer" ADD COLUMN     "escrowAmount" DOUBLE PRECISION,
ADD COLUMN     "escrowStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "isEscrowEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ObservationReport" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "signalType" TEXT NOT NULL,
    "signalStrength" INTEGER,
    "observerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ObservationReport" ADD CONSTRAINT "ObservationReport_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

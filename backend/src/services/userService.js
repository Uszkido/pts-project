const prisma = require('../db');
const bcrypt = require('bcryptjs');
const { verifyCAC, verifyNIN } = require('./monoService');
const IdentityValidationService = require('./identityValidationService');
const { verifyFacialIdentityLiveness } = require('./aiService');

/**
 * Stage 1: Store registration data in PendingUser and generate OTP
 */
const startRegistration = async (data) => {
    const {
        email, password, role, fullName, nationalId,
        facialDataUrl, phoneNumber, address,
        companyName, businessAddress, businessRegNo,
        shopPhotoUrl, cacCertificateUrl, shopLatitude, shopLongitude
    } = data;

    if (phoneNumber) {
        const phoneCheck = IdentityValidationService.validatePhone(phoneNumber);
        if (!phoneCheck.isValid) {
            throw new Error('Invalid Nigerian phone number format detected. Validation rejected.');
        }
        // Normalize the phone number using the offline tool before saving
        data.phoneNumber = phoneCheck.formatted;
    }

    // Check if user already exists in real table
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('User already exists in the registry.');
    }

    // --- MONO API CAC REGISTRATION VERIFICATION ---
    if (role === 'VENDOR' && businessRegNo) {
        const cacCheck = await verifyCAC(businessRegNo);
        if (!cacCheck.valid) {
            throw new Error(`CAC Verification Failed: ${cacCheck.reason}`);
        }

        // Ensure the registry company name aligns with the official CAC database name if found
        // data.companyName is what they entered. We can accept it, but note CAC validation passed
    }

    // --- MONO API NIN IDENTITY VERIFICATION ---
    if (nationalId) {
        const ninCheck = await verifyNIN(nationalId);
        if (!ninCheck.valid) {
            throw new Error(`Identity Verification Failed: ${ninCheck.reason}`);
        }
    }

    // --- BIOMETRIC LIVENESS & IDENTITY CHECK ---
    if (facialDataUrl) {
        const faceCheck = await verifyFacialIdentityLiveness(facialDataUrl);
        if (!faceCheck.isValid) {
            // High security block: If AI detects a spoof (photo of a screen, mask, etc.)
            throw new Error(`Biometric Security Rejected: ${faceCheck.reason}`);
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert into PendingUser (replace if they try again with same email)
    const pending = await prisma.pendingUser.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role, fullName, nationalId, facialDataUrl, phoneNumber, address,
            companyName, businessAddress, businessRegNo, shopPhotoUrl,
            cacCertificateUrl, shopLatitude: shopLatitude ? parseFloat(shopLatitude) : null,
            shopLongitude: shopLongitude ? parseFloat(shopLongitude) : null,
            otp
        },
        create: {
            email,
            password: hashedPassword,
            role, fullName, nationalId, facialDataUrl, phoneNumber, address,
            companyName, businessAddress, businessRegNo, shopPhotoUrl,
            cacCertificateUrl, shopLatitude: shopLatitude ? parseFloat(shopLatitude) : null,
            shopLongitude: shopLongitude ? parseFloat(shopLongitude) : null,
            otp
        }
    });

    return { pending, otp };
};

/**
 * Stage 2: Finalize registration from PendingUser to User
 */
const finalizeRegistration = async (email, otp) => {
    const pending = await prisma.pendingUser.findUnique({ where: { email } });

    if (!pending || pending.otp !== otp) {
        throw new Error('Invalid or expired OTP');
    }

    // Create the real user
    const user = await prisma.user.create({
        data: {
            email: pending.email,
            password: pending.password,
            role: pending.role,
            fullName: pending.fullName,
            nationalId: pending.nationalId,
            facialDataUrl: pending.facialDataUrl,
            phoneNumber: pending.phoneNumber,
            address: pending.address,
            companyName: pending.companyName,
            businessAddress: pending.businessAddress,
            businessRegNo: pending.businessRegNo,
            shopPhotoUrl: pending.shopPhotoUrl,
            cacCertificateUrl: pending.cacCertificateUrl,
            shopLatitude: pending.shopLatitude,
            shopLongitude: pending.shopLongitude,
            vendorStatus: pending.role === 'VENDOR' ? 'PENDING' : 'APPROVED',
            isEmailConfirmed: true // They just verified it
        }
    });

    // Delete the pending record
    await prisma.pendingUser.delete({ where: { email } });

    return user;
};

module.exports = { startRegistration, finalizeRegistration };

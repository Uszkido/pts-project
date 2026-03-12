const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

/**
 * Shared logic for registering a user from Web or Bots
 */
const registerUser = async (data) => {
    const {
        email, password, role, fullName, nationalId,
        facialDataUrl, phoneNumber, address,
        companyName, businessAddress, businessRegNo,
        shopPhotoUrl, cacCertificateUrl, shopLatitude, shopLongitude
    } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const finalRole = role === 'CONSUMER' ? 'CONSUMER' : 'VENDOR';

    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            role: finalRole,
            fullName,
            nationalId,
            facialDataUrl,
            phoneNumber,
            address,
            companyName: finalRole === 'VENDOR' ? companyName : null,
            businessAddress: finalRole === 'VENDOR' ? businessAddress : null,
            businessRegNo: finalRole === 'VENDOR' ? businessRegNo : null,
            shopPhotoUrl: finalRole === 'VENDOR' ? shopPhotoUrl : null,
            cacCertificateUrl: finalRole === 'VENDOR' ? cacCertificateUrl : null,
            shopLatitude: finalRole === 'VENDOR' && shopLatitude ? parseFloat(shopLatitude) : null,
            shopLongitude: finalRole === 'VENDOR' && shopLongitude ? parseFloat(shopLongitude) : null,
            vendorStatus: finalRole === 'VENDOR' ? 'PENDING' : 'APPROVED',
            isEmailConfirmed: false,
            emailVerificationOtp: otp
        }
    });

    return { user, otp };
};

module.exports = { registerUser };

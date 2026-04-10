import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const API_URL = 'https://pts-backend-api.vercel.app/api/v1';
const prisma = new PrismaClient();
const adminEmail = `admin@vexel.local`;
const testPassword = 'Password123!';

async function createAdmin() {
    try {
        console.log(`Registering Admin...`);
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: adminEmail,
                password: testPassword,
                fullName: 'Super Admin',
                companyName: 'Vexel Command',
                role: 'ADMIN'
            })
        });

        const pending = await prisma.pendingUser.findUnique({ where: { email: adminEmail } });
        if (pending) {
            console.log(`Verifying OTP: ${pending.otp}`);
            await fetch(`${API_URL}/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail, otp: pending.otp })
            });
        }

        console.log(`Login: ${adminEmail} / ${testPassword}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
createAdmin();

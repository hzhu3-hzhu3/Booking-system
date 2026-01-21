import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@example.com';
  
  console.log(`Making ${email} an admin...`);
  
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
  });
  
  console.log('✅ User is now an admin:', user.email);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

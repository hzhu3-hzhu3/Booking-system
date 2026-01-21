import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.ruleConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      openHour: 8,
      closeHour: 22,
      timeSlotIntervalMinutes: 15,
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      maxActiveBookings: 3,
      minNoticeMinutes: 30,
      maxDaysAhead: 14,
    },
  });
  console.log('✅ Rules initialized');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

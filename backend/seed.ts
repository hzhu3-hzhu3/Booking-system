import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create rule config (MUST exist with id=1)
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
  console.log('✅ Rule config created');

  // 2. Create rooms
  const rooms = [
    {
      name: 'Conference Room A',
      capacity: 10,
      equipment: ['Projector', 'Whiteboard', 'TV'],
      status: 'active' as const,
    },
    {
      name: 'Meeting Room B',
      capacity: 6,
      equipment: ['Whiteboard', 'Conference Phone'],
      status: 'active' as const,
    },
    {
      name: 'Small Room C',
      capacity: 4,
      equipment: ['Whiteboard'],
      status: 'active' as const,
    },
    {
      name: 'Large Conference D',
      capacity: 20,
      equipment: ['Projector', 'TV', 'Whiteboard', 'Conference Phone'],
      status: 'active' as const,
    },
    {
      name: 'Huddle Room E',
      capacity: 3,
      equipment: ['TV'],
      status: 'active' as const,
    },
  ];

  for (const room of rooms) {
    try {
      await prisma.room.create({ data: room });
      console.log(`✅ Created room: ${room.name}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⚠️  Room already exists: ${room.name}`);
      }
    }
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

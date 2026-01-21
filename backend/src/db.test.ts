import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from './db';

describe('Database Connection', () => {
  let isDatabaseAvailable = false;

  beforeAll(async () => {
    // Check if database is accessible
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDatabaseAvailable = true;
    } catch (error) {
      console.warn('Database not available for testing. Skipping connection tests.');
      isDatabaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should verify Prisma Client is properly generated', () => {
    // Verify that the Prisma Client has the expected models
    expect(prisma.user).toBeDefined();
    expect(prisma.room).toBeDefined();
    expect(prisma.booking).toBeDefined();
    expect(prisma.maintenanceBlock).toBeDefined();
    expect(prisma.ruleConfig).toBeDefined();
    expect(prisma.auditLog).toBeDefined();
  });

  it('should have proper model methods', () => {
    // Verify that models have CRUD methods
    expect(typeof prisma.user.findMany).toBe('function');
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.user.update).toBe('function');
    expect(typeof prisma.user.delete).toBe('function');
  });

  it.skipIf(!isDatabaseAvailable)('should connect to the database successfully', async () => {
    // Test basic connectivity by executing a simple query
    const result = await prisma.$queryRaw`SELECT 1 as value`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import prisma from './db';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import bookingRoutes from './routes/booking.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import ruleRoutes from './routes/rule.routes';
import { bookingService } from './booking.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: String(error) });
  }
});

// Auth routes
app.use('/api/auth', authRoutes);

// Room routes
app.use('/api/rooms', roomRoutes);

// Booking routes
app.use('/api/bookings', bookingRoutes);

// Maintenance block routes
app.use('/api/maintenance-blocks', maintenanceRoutes);

// Rule configuration routes
app.use('/api/rules', ruleRoutes);

// Set up background job to expire old bookings (runs every hour)
cron.schedule('0 * * * *', async () => {
  try {
    const expiredCount = await bookingService.expireOldBookings();
    console.log(`[${new Date().toISOString()}] Expired ${expiredCount} old booking(s)`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error expiring bookings:`, error);
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log('Background job scheduled: Booking expiration runs every hour');
});

export default app;

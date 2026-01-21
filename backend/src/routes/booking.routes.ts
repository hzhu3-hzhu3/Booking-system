import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth';
import { bookingService } from '../booking.service';
import { auditLogService } from '../audit.service';

const router = Router();

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId, startAt, endAt } = req.body;
    const userId = req.user!.userId;

    // Validate required fields
    if (!roomId || !startAt || !endAt) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'roomId, startAt, and endAt are required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Parse and validate dates
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (isNaN(startDate.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid startAt date format. Use ISO 8601 format',
          field: 'startAt',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    if (isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid endAt date format. Use ISO 8601 format',
          field: 'endAt',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate time range
    if (startDate >= endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TIME_RANGE',
          message: 'startAt must be before endAt',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Create booking
    const booking = await bookingService.createBooking(
      userId,
      roomId,
      startDate,
      endDate
    );

    // Log booking creation
    await auditLogService.logBookingCreated(userId, booking.id, {
      roomId: booking.roomId,
      roomName: booking.room.name,
      startAt: booking.startAt,
      endAt: booking.endAt,
    });

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof Error) {
      // Map error messages to appropriate error codes
      const errorMessage = error.message;

      // Conflict errors (check these before time slot errors)
      if (errorMessage.includes('already booked')) {
        return res.status(409).json({
          error: {
            code: 'BOOKING_CONFLICT',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('maintenance')) {
        return res.status(409).json({
          error: {
            code: 'MAINTENANCE_CONFLICT',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('archived') || errorMessage.includes('under maintenance')) {
        return res.status(409).json({
          error: {
            code: 'ROOM_UNAVAILABLE',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      // Time window errors
      if (errorMessage.includes('operating hours') || errorMessage.includes('OPEN_HOUR') || errorMessage.includes('CLOSE_HOUR')) {
        return res.status(400).json({
          error: {
            code: 'OUTSIDE_OPERATING_HOURS',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('time slot') || errorMessage.includes('interval')) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TIME_SLOT',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      // Duration errors
      if (errorMessage.includes('minimum duration') || errorMessage.includes('MIN_DURATION')) {
        return res.status(400).json({
          error: {
            code: 'DURATION_TOO_SHORT',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('maximum duration') || errorMessage.includes('MAX_DURATION')) {
        return res.status(400).json({
          error: {
            code: 'DURATION_TOO_LONG',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      // Horizon errors
      if (errorMessage.includes('minimum notice') || errorMessage.includes('MIN_NOTICE')) {
        return res.status(400).json({
          error: {
            code: 'TOO_SOON',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('maximum advance') || errorMessage.includes('MAX_DAYS_AHEAD')) {
        return res.status(400).json({
          error: {
            code: 'TOO_FAR_AHEAD',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      // Fair usage errors
      if (errorMessage.includes('Maximum active bookings') || errorMessage.includes('MAX_ACTIVE_BOOKINGS')) {
        return res.status(409).json({
          error: {
            code: 'MAX_BOOKINGS_REACHED',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('Cooldown') || errorMessage.includes('COOLDOWN')) {
        return res.status(409).json({
          error: {
            code: 'COOLDOWN_ACTIVE',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('consecutive') || errorMessage.includes('MAX_CONSECUTIVE')) {
        return res.status(409).json({
          error: {
            code: 'CONSECUTIVE_LIMIT',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      // Resource not found errors
      if (errorMessage.includes('Room not found')) {
        return res.status(404).json({
          error: {
            code: 'ROOM_NOT_FOUND',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating the booking',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const bookings = await bookingService.getUserBookings(userId);

    res.json(bookings);
  } catch (error) {
        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching bookings',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';

    const cancelledBooking = await bookingService.cancelBooking(id, userId, isAdmin);

    // Log booking cancellation
    await auditLogService.logBookingCancelled(userId, cancelledBooking.id, {
      roomId: cancelledBooking.roomId,
      roomName: cancelledBooking.room.name,
      startAt: cancelledBooking.startAt,
      endAt: cancelledBooking.endAt,
      cancelledBy: userId,
    });

    res.json({ success: true, booking: cancelledBooking });
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes('Booking not found')) {
        return res.status(404).json({
          error: {
            code: 'BOOKING_NOT_FOUND',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('only cancel your own')) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (errorMessage.includes('Cannot cancel past') || errorMessage.includes('already cancelled')) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while cancelling the booking',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, roomId, startDate, endDate, page, limit } = req.query;

    // Parse pagination parameters
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'page must be a positive integer',
          field: 'page',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'limit must be between 1 and 100',
          field: 'limit',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Build where clause
    const whereClause: any = {};

    if (userId) {
      whereClause.userId = userId as string;
    }

    if (roomId) {
      whereClause.roomId = roomId as string;
    }

    // Parse date filters
    if (startDate || endDate) {
      whereClause.AND = [];

      if (startDate) {
        const startDateObj = new Date(startDate as string);
        if (isNaN(startDateObj.getTime())) {
          return res.status(400).json({
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid startDate format. Use ISO date format',
              field: 'startDate',
            },
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }
        whereClause.AND.push({ startAt: { gte: startDateObj } });
      }

      if (endDate) {
        const endDateObj = new Date(endDate as string);
        if (isNaN(endDateObj.getTime())) {
          return res.status(400).json({
            error: {
              code: 'INVALID_INPUT',
              message: 'Invalid endDate format. Use ISO date format',
              field: 'endDate',
            },
            timestamp: new Date().toISOString(),
            path: req.path,
          });
        }
        whereClause.AND.push({ endAt: { lte: endDateObj } });
      }
    }

    // Calculate skip for pagination
    const skip = (pageNum - 1) * limitNum;

    // Import prisma to query bookings
    const prisma = (await import('../db')).default;

    // Get total count for pagination
    const total = await prisma.booking.count({
      where: whereClause,
    });

    // Get bookings with filters and pagination
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            capacity: true,
            equipment: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        startAt: 'desc',
      },
      take: limitNum,
      skip,
    });

    res.json({
      bookings,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching bookings',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export default router;

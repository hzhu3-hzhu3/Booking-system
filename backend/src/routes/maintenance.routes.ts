import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth';
import { maintenanceBlockService } from '../maintenance.service';

const router = Router();

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId, startAt, endAt, reason } = req.body;

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

    // Create maintenance block
    const maintenanceBlock = await maintenanceBlockService.createMaintenanceBlock({
      roomId,
      startAt: startDate,
      endAt: endDate,
      reason,
    });

    res.status(201).json(maintenanceBlock);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'ROOM_NOT_FOUND') {
        return res.status(404).json({
          error: {
            code: 'ROOM_NOT_FOUND',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (error.name === 'INVALID_TIME_RANGE') {
        return res.status(400).json({
          error: {
            code: 'INVALID_TIME_RANGE',
            message: error.message,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating the maintenance block',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { roomId, startDate, endDate } = req.query;

    // Build filter object
    const filter: any = {};

    if (roomId) {
      filter.roomId = roomId as string;
    }

    // Parse date filters
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
      filter.startDate = startDateObj;
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
      filter.endDate = endDateObj;
    }

    const maintenanceBlocks = await maintenanceBlockService.getMaintenanceBlocks(filter);

    res.json(maintenanceBlocks);
  } catch (error) {
        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching maintenance blocks',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await maintenanceBlockService.deleteMaintenanceBlock(id);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'MAINTENANCE_BLOCK_NOT_FOUND') {
      return res.status(404).json({
        error: {
          code: 'MAINTENANCE_BLOCK_NOT_FOUND',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while deleting the maintenance block',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export default router;

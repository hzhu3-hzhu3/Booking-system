import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth';
import { roomService } from '../room.service';
import { RoomStatus } from '@prisma/client';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rooms = await roomService.getAllRooms();
    res.json(rooms);
  } catch (error) {
        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching rooms',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { date, startTime, endTime, minCapacity, equipment } = req.query;

    // Validate required parameters
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'date, startTime, and endTime are required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate date format
    const dateObj = new Date(date as string);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid date format. Use ISO date format (YYYY-MM-DD)',
          field: 'date',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime as string)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid startTime format. Use HH:mm format',
          field: 'startTime',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    if (!timeRegex.test(endTime as string)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid endTime format. Use HH:mm format',
          field: 'endTime',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Parse equipment tags
    let equipmentTags: string[] | undefined;
    if (equipment) {
      equipmentTags = Array.isArray(equipment) 
        ? equipment as string[]
        : [equipment as string];
    }

    // Parse minCapacity
    let minCapacityNum: number | undefined;
    if (minCapacity) {
      minCapacityNum = parseInt(minCapacity as string, 10);
      if (isNaN(minCapacityNum) || minCapacityNum < 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'minCapacity must be a positive number',
            field: 'minCapacity',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

    const rooms = await roomService.searchRooms({
      date: dateObj,
      startTime: startTime as string,
      endTime: endTime as string,
      minCapacity: minCapacityNum,
      equipmentTags,
    });

    res.json(rooms);
  } catch (error) {
        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while searching rooms',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await roomService.getRoomById(id);

    if (!room) {
      return res.status(404).json({
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    res.json(room);
  } catch (error) {
        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching room details',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, capacity, equipment, status } = req.body;

    // Validate required fields
    if (!name || capacity === undefined || !status) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'name, capacity, and status are required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate capacity
    if (typeof capacity !== 'number' || capacity <= 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'capacity must be a positive number',
          field: 'capacity',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate status
    const validStatuses: RoomStatus[] = ['active', 'maintenance', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be one of: active, maintenance, archived',
          field: 'status',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate equipment (should be array)
    const equipmentArray = equipment || [];
    if (!Array.isArray(equipmentArray)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'equipment must be an array',
          field: 'equipment',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    const room = await roomService.createRoom({
      name,
      capacity,
      equipment: equipmentArray,
      status,
    });

    res.status(201).json(room);
  } catch (error) {
    if (error instanceof Error && error.name === 'DUPLICATE_NAME') {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_NAME',
          message: error.message,
          field: 'name',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating the room',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, capacity, equipment, status } = req.body;

    // Validate at least one field is provided
    if (!name && capacity === undefined && !equipment && !status) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one field must be provided for update',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate capacity if provided
    if (capacity !== undefined && (typeof capacity !== 'number' || capacity <= 0)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'capacity must be a positive number',
          field: 'capacity',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate status if provided
    if (status) {
      const validStatuses: RoomStatus[] = ['active', 'maintenance', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'status must be one of: active, maintenance, archived',
            field: 'status',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

    // Validate equipment if provided
    if (equipment !== undefined && !Array.isArray(equipment)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'equipment must be an array',
          field: 'equipment',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (equipment !== undefined) updateData.equipment = equipment;
    if (status) updateData.status = status;

    const room = await roomService.updateRoom(id, updateData);

    res.json(room);
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

      if (error.name === 'DUPLICATE_NAME') {
        return res.status(409).json({
          error: {
            code: 'DUPLICATE_NAME',
            message: error.message,
            field: 'name',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating the room',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await roomService.archiveRoom(id);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'ROOM_NOT_FOUND') {
      return res.status(404).json({
        error: {
          code: 'ROOM_NOT_FOUND',
          message: error.message,
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while archiving the room',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export default router;

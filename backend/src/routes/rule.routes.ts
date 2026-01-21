import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth';
import { ruleService } from '../rule.service';
import { auditLogService } from '../audit.service';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rules = await ruleService.getRules();
    res.json(rules);
  } catch (error) {
    if (error instanceof Error && error.message === 'RULES_NOT_FOUND') {
      return res.status(404).json({
        error: {
          code: 'RULES_NOT_FOUND',
          message: 'Rule configuration not found',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching rule configuration',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.put('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;

    // Validate that at least one field is provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'At least one rule field must be provided for update',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Get current rules for audit log
    const oldRules = await ruleService.getRules();

    // Update rules
    const updatedRules = await ruleService.updateRules(updates);

    // Log the rule update
    await auditLogService.logRulesUpdated(req.user!.userId, {
      before: oldRules,
      after: updatedRules,
      changes: updates,
    });

    res.json(updatedRules);
  } catch (error) {
    if (error instanceof Error) {
      // Handle validation errors
      if (
        error.name === 'INVALID_OPEN_HOUR' ||
        error.name === 'INVALID_CLOSE_HOUR' ||
        error.name === 'INVALID_HOURS' ||
        error.name === 'INVALID_TIME_SLOT_INTERVAL' ||
        error.name === 'INVALID_MIN_DURATION' ||
        error.name === 'INVALID_MAX_DURATION' ||
        error.name === 'INVALID_DURATION_RANGE' ||
        error.name === 'INVALID_MAX_ACTIVE_BOOKINGS' ||
        error.name === 'INVALID_MAX_CONSECUTIVE' ||
        error.name === 'INVALID_COOLDOWN' ||
        error.name === 'INVALID_MIN_NOTICE' ||
        error.name === 'INVALID_MAX_DAYS_AHEAD' ||
        error.name === 'INVALID_RULE_VALUES'
      ) {
        return res.status(400).json({
          error: {
            code: error.name,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }

      if (error.message === 'RULES_NOT_FOUND') {
        return res.status(404).json({
          error: {
            code: 'RULES_NOT_FOUND',
            message: 'Rule configuration not found',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
      }
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating rule configuration',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export default router;

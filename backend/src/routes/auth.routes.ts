import { Router, Request, Response } from 'express';
import { registerUser, loginUser } from '../auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Email and password are required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid email format',
          field: 'email',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Password must be at least 6 characters',
          field: 'password',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    const result = await registerUser(email, password);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_EXISTS') {
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
          field: 'email',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during registration',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Email and password are required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

        res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export default router;

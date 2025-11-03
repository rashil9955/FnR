import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { createUser, authenticate, getUserById, verifyToken } from '../services/authService.js';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    const user = await createUser({ email, password, name });
    res.status(201).json({ user });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { token, user } = await authenticate({ email, password });
    res.json({ token, user });
  })
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const payload = verifyToken(token);
    const user = await getUserById(payload.sub);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  })
);

export default router;

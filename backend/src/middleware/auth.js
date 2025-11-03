import { verifyToken, getUserById } from '../services/authService.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const payload = verifyToken(token);
    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    console.error('Auth error', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
}

export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, (err) => {
    if (err) {
      return next(err);
    }
  });
  if (!req.user || !req.user.email?.endsWith('@admin.local')) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../models/db.js';
import { config } from '../config/env.js';

export async function createUser({ email, password, name }) {
  const hashed = password ? await bcrypt.hash(password, 10) : null;
  const existing = await db('users').where({ email }).first();
  if (existing) {
    throw new Error('User already exists');
  }
  const [user] = await db('users')
    .insert({ email, name, hashed_password: hashed })
    .returning(['id', 'email', 'name', 'created_at']);
  return user;
}

export async function authenticate({ email, password }) {
  const user = await db('users').where({ email }).first();
  if (!user) {
    throw new Error('Invalid credentials');
  }
  const valid = await bcrypt.compare(password, user.hashed_password || '');
  if (!valid) {
    throw new Error('Invalid credentials');
  }
  const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '12h' });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export async function getUserById(id) {
  return db('users').where({ id }).first();
}

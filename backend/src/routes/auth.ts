import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { signToken } from '../auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }
  const { rows } = await pool.query(
    'SELECT id, username, password, role FROM users WHERE username = $1',
    [username]
  );
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

export default router;

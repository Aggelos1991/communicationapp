import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get current user's profile
router.get('/me', async (req, res, next) => {
  try {
    const [profiles] = await db.query(
      'SELECT * FROM profiles WHERE id = ?',
      [req.user.id]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Remove totp_secret from response
    const profile = profiles[0];
    delete profile.totp_secret;

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Update current user's profile
router.patch('/me', async (req, res, next) => {
  try {
    const { name, role } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), req.user.id];

    await db.query(`UPDATE profiles SET ${setClause} WHERE id = ?`, values);

    const [updated] = await db.query('SELECT * FROM profiles WHERE id = ?', [req.user.id]);

    const profile = updated[0];
    delete profile.totp_secret;

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// Enable/disable TOTP
router.post('/totp', async (req, res, next) => {
  try {
    const { totp_secret, totp_enabled } = req.body;

    await db.query(
      'UPDATE profiles SET totp_secret = ?, totp_enabled = ? WHERE id = ?',
      [totp_secret || null, totp_enabled || false, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

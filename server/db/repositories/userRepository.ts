import pool from '../connection';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import type { User, Profile, UserInsert, ProfileInsert } from '../types';
import { RowDataPacket } from 'mysql2';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

/**
 * Create a new user with profile (transactional)
 */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: string = 'Staff'
): Promise<{ userId: string; profile: Profile }> {
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Insert user
    await connection.query<RowDataPacket[]>(
      `INSERT INTO users (id, email, password_hash, email_confirmed)
       VALUES (?, ?, ?, ?)`,
      [userId, email, passwordHash, true]
    );

    // Insert profile
    await connection.query<RowDataPacket[]>(
      `INSERT INTO profiles (id, email, name, role)
       VALUES (?, ?, ?, ?)`,
      [userId, email, name, role]
    );

    await connection.commit();

    // Fetch created profile
    const [profiles] = await connection.query<(Profile & RowDataPacket)[]>(
      'SELECT * FROM profiles WHERE id = ?',
      [userId]
    );

    return { userId, profile: profiles[0] };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Authenticate user by email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: User; profile: Profile } | null> {
  const [rows] = await pool.query<(User & Profile & RowDataPacket)[]>(
    `SELECT u.*, p.name, p.role, p.totp_enabled, p.totp_secret
     FROM users u
     JOIN profiles p ON u.id = p.id
     WHERE u.email = ?`,
    [email]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const isValid = await bcrypt.compare(password, row.password_hash);

  if (!isValid) {
    return null;
  }

  // Update last login
  await pool.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = ?',
    [row.id]
  );

  const user: User = {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    email_confirmed: row.email_confirmed,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at
  };

  const profile: Profile = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    totp_secret: row.totp_secret,
    totp_enabled: row.totp_enabled,
    created_at: row.created_at,
    updated_at: row.updated_at
  };

  return { user, profile };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const [rows] = await pool.query<(User & RowDataPacket)[]>(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get profile by user ID
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const [rows] = await pool.query<(Profile & RowDataPacket)[]>(
    'SELECT * FROM profiles WHERE id = ?',
    [userId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update profile
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'name' | 'role' | 'totp_secret' | 'totp_enabled'>>
): Promise<Profile> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }
  if (updates.totp_secret !== undefined) {
    fields.push('totp_secret = ?');
    values.push(updates.totp_secret);
  }
  if (updates.totp_enabled !== undefined) {
    fields.push('totp_enabled = ?');
    values.push(updates.totp_enabled);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(userId);

  await pool.query(
    `UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  const profile = await getProfileById(userId);
  if (!profile) {
    throw new Error('Profile not found after update');
  }

  return profile;
}

/**
 * Check if email exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  return rows.length > 0;
}

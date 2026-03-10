const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || 'dev-only-secret';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const otpStore = new Map();

function signToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

async function upsertUserByPhone(phone) {
  const email = `${phone.replace(/\D/g, '')}@phone.local`;
  const name = `User ${phone.slice(-4)}`;

  const query = `
    INSERT INTO users (full_name, email, phone, password_hash, role)
    VALUES ($1, $2, $3, $4, 'customer')
    ON CONFLICT (email)
    DO UPDATE SET phone = EXCLUDED.phone
    RETURNING id, full_name, email, phone, role
  `;

  const { rows } = await pool.query(query, [name, email, phone, 'otp-auth-no-password']);
  return rows[0];
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, db: 'disconnected', error: error.message });
  }
});

app.post('/api/inquiries', async (req, res) => {
  const {
    name,
    email,
    phone,
    property,
    tentativeDate,
    tentativeAmount,
    services
  } = req.body;

  if (!name || !email || !phone || !property || !tentativeDate || tentativeAmount == null || !Array.isArray(services)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!services.length) {
    return res.status(400).json({ error: 'Select at least one service' });
  }

  const query = `
    INSERT INTO inquiries
      (full_name, email, phone, moving_to_property, tentative_date, tentative_rental_amount, services_required)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `;

  const values = [name, email, phone, property, tentativeDate, tentativeAmount, services];

  try {
    const { rows } = await pool.query(query, values);
    return res.status(201).json({
      message: 'Inquiry submitted successfully',
      inquiry: rows[0]
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to submit inquiry', detail: error.message });
  }
});

app.post('/api/auth/otp/send', (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone is required' });
  }

  const otp = '123456';
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  return res.json({ message: 'OTP sent successfully', devOtp: otp });
});

app.post('/api/auth/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  const entry = otpStore.get(phone);

  if (!entry) {
    return res.status(400).json({ error: 'OTP not requested for this phone number' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (otp !== entry.otp) {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }

  try {
    const user = await upsertUserByPhone(phone);
    const token = signToken(user);
    otpStore.delete(phone);
    return res.json({ message: 'Login successful', token, user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to login', detail: error.message });
  }
});

app.get('/api/auth/google/start', (_req, res) => {
  return res.status(501).json({
    error: 'Google OAuth not configured yet',
    nextStep: 'Set GOOGLE_CLIENT_ID/SECRET and implement OAuth callback flow'
  });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name, email, phone, role, created_at, updated_at FROM users WHERE id = $1',
      [req.user.sub]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch profile', detail: error.message });
  }
});

app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.sub]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch bookings', detail: error.message });
  }
});

app.get('/api/properties', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM properties WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.sub]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch properties', detail: error.message });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.sub]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch payments', detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

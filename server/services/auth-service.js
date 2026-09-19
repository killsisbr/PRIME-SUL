const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { get, run } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const JWT_EXPIRY = '24h';

class AuthService {
  /**
   * Login: email + password → JWT token
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password required');
    }

    const seller = await get(
      'SELECT id, name, email, password, role FROM sellers WHERE email = ?',
      [email]
    );

    if (!seller) {
      throw new Error('Seller not found');
    }

    const isValid = await bcrypt.compare(password, seller.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign(
      {
        id: seller.id,
        email: seller.email,
        name: seller.name,
        role: seller.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return {
      success: true,
      token,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        role: seller.role
      }
    };
  }

  /**
   * Create seller
   */
  async createSeller(name, email, password, phone, role = 'seller') {
    if (!name || !email || !password || !phone) {
      throw new Error('Name, email, password, and phone are required');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert
    const result = await run(
      'INSERT INTO sellers (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone, role]
    );

    return {
      success: true,
      id: result.lastID,
      message: 'Seller created successfully'
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  /**
   * Get seller by ID
   */
  async getSellerById(id) {
    return get(
      'SELECT id, name, email, role, active FROM sellers WHERE id = ?',
      [id]
    );
  }
}

module.exports = new AuthService();

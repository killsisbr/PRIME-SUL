# Authentication — Checkpoint 1.1

## Overview

JWT-based authentication for PRIME SUL Assistant. Stateless token system with 24h expiry.

---

## Endpoints

### POST /api/auth/login

Login with email and password.

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@test.com",
    "password": "seller123"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "seller": {
    "id": 2,
    "name": "Test Seller",
    "email": "seller@test.com",
    "role": "seller"
  }
}
```

---

### POST /api/auth/logout

Logout (client-side removes token).

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful (remove token client-side)"
}
```

---

### GET /api/auth/me

Get current user info (protected).

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/auth/me
```

**Response (200):**
```json
{
  "success": true,
  "seller": {
    "id": 2,
    "name": "Test Seller",
    "email": "seller@test.com",
    "role": "seller",
    "active": 1
  }
}
```

---

### POST /api/auth/register (Admin Only)

Register a new seller.

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Seller",
    "email": "new@seller.com",
    "password": "securepass",
    "phone": "1198765432",
    "role": "seller"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "id": 3,
  "message": "Seller created successfully"
}
```

---

## Test Credentials

**Admin:**
- Email: `admin@test.com`
- Password: `admin123`
- Role: `admin`

**Seller:**
- Email: `seller@test.com`
- Password: `seller123`
- Role: `seller`

Use these to test login and protected endpoints.

---

## Implementation Details

| Feature | Value |
|---------|-------|
| Password hashing | bcryptjs (10 rounds) |
| Token type | JWT (JSON Web Token) |
| Token expiry | 24 hours |
| Secret | `JWT_SECRET` env variable |
| Algorithm | HS256 |
| Stored in | Authorization header (`Bearer <token>`) |

---

## Security

- ✅ Passwords never returned in responses
- ✅ Tokens expire after 24h
- ✅ Use HTTPS in production
- ✅ Change `JWT_SECRET` in production
- ⚠️ Rate limiting should be implemented (Fase 2)

---

## Error Responses

### 401 Unauthorized

Missing or invalid token:
```json
{
  "error": "Invalid token",
  "message": "Token expired or malformed"
}
```

### 403 Forbidden

Admin-only endpoint accessed by non-admin:
```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

### 400 Bad Request

Invalid input:
```json
{
  "error": "Registration failed",
  "message": "Email and password are required"
}
```

---

## Files

- `server/services/auth-service.js` — Login, token generation, verification
- `server/middleware/auth.js` — JWT middleware
- `server/routes/auth.js` — HTTP endpoints
- `server/database/schema.sql` — Sellers table schema

---

## Testing

Run tests:
```bash
npm test
```

Run server:
```bash
npm run dev
```

Initialize database:
```bash
npm run db:init
```

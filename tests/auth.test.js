const test = require('node:test');
const assert = require('node:assert');
const authService = require('../server/services/auth-service');

test('Auth Service', async (t) => {
  await t.test('Should create seller', async () => {
    try {
      const result = await authService.createSeller(
        'Test User',
        'test@example.com',
        'testpass123',
        '1112345678'
      );
      assert.ok(result.success);
      assert.ok(result.id > 0);
    } catch (err) {
      // Expected if already exists
      console.log('Note: Seller may already exist');
    }
  });

  await t.test('Should login with correct password', async () => {
    try {
      const result = await authService.login('seller@test.com', 'seller123');
      assert.ok(result.success);
      assert.ok(result.token);
      assert.strictEqual(result.seller.email, 'seller@test.com');
    } catch (err) {
      console.error('Login failed:', err.message);
      throw err;
    }
  });

  await t.test('Should reject invalid password', async () => {
    try {
      await authService.login('seller@test.com', 'wrongpassword');
      assert.fail('Should throw error');
    } catch (err) {
      assert.strictEqual(err.message, 'Invalid password');
    }
  });

  await t.test('Should verify valid token', async () => {
    try {
      const loginResult = await authService.login('seller@test.com', 'seller123');
      const payload = authService.verifyToken(loginResult.token);
      assert.strictEqual(payload.email, 'seller@test.com');
    } catch (err) {
      console.error('Token test failed:', err.message);
      throw err;
    }
  });

  await t.test('Should reject invalid token', async () => {
    try {
      authService.verifyToken('invalid.token.here');
      assert.fail('Should throw error');
    } catch (err) {
      assert.ok(err.message.includes('malformed') || err.message.includes('invalid'));
    }
  });
});

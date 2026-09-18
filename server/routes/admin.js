const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');

// Reset database endpoint (preserve sessions table)
router.post('/reset-database', auth, adminOnly, async (req, res, next) => {
  try {
    const db = require('../database/db');

    // Get all table names
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");

    // Tables to preserve (we want to keep sessions table for WhatsApp connections)
    const exclude = ['sessions'];

    console.log('Starting database reset...');
    console.log('Tables found:', tables.map(t => t.name));
    console.log('Tables to preserve:', exclude);

    // Delete data from non-excluded tables
    for (const table of tables) {
      const tableName = table.name;
      if (!exclude.includes(tableName)) {
        console.log(`Clearing table: ${tableName}`);
        await db.run(`DELETE FROM ${tableName}`);
        // Reset autoincrement counter for this table
        await db.run(`DELETE FROM sqlite_sequence WHERE name = '${tableName}'`);
        console.log(`  → Data cleared and auto-increment reset for ${tableName}`);
      } else {
        console.log(`  → Skipping ${tableName} (preserved as requested)`);
      }
    }

    console.log('Database reset completed successfully.');
    res.json({
      success: true,
      message: 'Database reset successfully. Sessions table preserved.'
    });
  } catch (e) {
    console.error('Error during database reset:', e.message);
    next(e);
  }
});

module.exports = router;
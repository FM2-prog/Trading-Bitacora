import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("trades.db");
db.exec("PRAGMA foreign_keys = ON;");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    account_id TEXT NOT NULL,
    capital REAL NOT NULL,
    type TEXT CHECK(type IN ('PERSONAL', 'PROP_FIRM')) NOT NULL,
    profit_target REAL,
    loss_limit REAL
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    entry_triggers TEXT,
    exit_triggers TEXT,
    has_candlestick BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    strategy_id INTEGER,
    instrument TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    lots REAL NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL,
    sl REAL,
    tp REAL,
    profit REAL DEFAULT 0,
    type TEXT CHECK(type IN ('LONG', 'SHORT')) NOT NULL,
    status TEXT DEFAULT 'OPEN',
    comments TEXT,
    image_url TEXT,
    executed_entry_triggers TEXT,
    executed_exit_triggers TEXT,
    candlestick_used TEXT,
    riesgo_asumido_porcentaje REAL,
    beneficio_obtenido_porcentaje REAL,
    mae REAL,
    mfe REAL,
    riesgo_asumido_dinero REAL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (strategy_id) REFERENCES strategies(id)
  );
`);

// Migrations for existing tables
const migrate = () => {
  const strategyColumns = [
    { name: 'entry_triggers', type: 'TEXT' },
    { name: 'exit_triggers', type: 'TEXT' },
    { name: 'has_candlestick', type: 'BOOLEAN' }
  ];

  const tradeColumns = [
    { name: 'executed_entry_triggers', type: 'TEXT' },
    { name: 'executed_exit_triggers', type: 'TEXT' },
    { name: 'candlestick_used', type: 'TEXT' },
    { name: 'riesgo_asumido_porcentaje', type: 'REAL' },
    { name: 'beneficio_obtenido_porcentaje', type: 'REAL' },
    { name: 'mae', type: 'REAL' },
    { name: 'mfe', type: 'REAL' },
    { name: 'riesgo_asumido_dinero', type: 'REAL' }
  ];

  const sTableInfo = db.prepare("PRAGMA table_info(strategies)").all() as any[];
  const sExistingColumns = sTableInfo.map(c => c.name);

  // Handle renaming triggers to entry_triggers if it exists
  if (sExistingColumns.includes('triggers') && !sExistingColumns.includes('entry_triggers')) {
    try {
      db.exec(`ALTER TABLE strategies RENAME COLUMN triggers TO entry_triggers`);
      console.log(`Renamed triggers to entry_triggers in strategies table`);
    } catch (err) {
      console.error(`Error renaming triggers to entry_triggers:`, err);
    }
  }

  for (const col of strategyColumns) {
    if (!sExistingColumns.includes(col.name) && col.name !== 'entry_triggers') {
      try {
        db.exec(`ALTER TABLE strategies ADD COLUMN ${col.name} ${col.type}`);
      } catch (err) {
        console.error(`Error adding column ${col.name} to strategies:`, err);
      }
    }
  }

  const tTableInfo = db.prepare("PRAGMA table_info(trades)").all() as any[];
  const tExistingColumns = tTableInfo.map(c => c.name);

  // Handle renaming executed_triggers to executed_entry_triggers if it exists
  if (tExistingColumns.includes('executed_triggers') && !tExistingColumns.includes('executed_entry_triggers')) {
    try {
      db.exec(`ALTER TABLE trades RENAME COLUMN executed_triggers TO executed_entry_triggers`);
      console.log(`Renamed executed_triggers to executed_entry_triggers in trades table`);
    } catch (err) {
      console.error(`Error renaming executed_triggers to executed_entry_triggers:`, err);
    }
  }

  for (const col of tradeColumns) {
    if (!tExistingColumns.includes(col.name) && col.name !== 'executed_entry_triggers') {
      try {
        db.exec(`ALTER TABLE trades ADD COLUMN ${col.name} ${col.type}`);
      } catch (err) {
        console.error(`Error adding column ${col.name} to trades:`, err);
      }
    }
  }
};

migrate();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Account API Routes
  app.get("/api/accounts", (req, res) => {
    const accounts = db.prepare("SELECT * FROM accounts").all();
    res.json(accounts);
  });

  app.post("/api/accounts", (req, res) => {
    const { name, account_id, capital, type, profit_target, loss_limit } = req.body;
    const info = db.prepare(`
      INSERT INTO accounts (name, account_id, capital, type, profit_target, loss_limit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, account_id, capital, type, profit_target, loss_limit);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/accounts/:id", (req, res) => {
    const id = req.params.id;
    // Delete all trades associated with this account first to avoid foreign key constraint issues
    db.prepare("DELETE FROM trades WHERE account_id = ?").run(id);
    db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.put("/api/accounts/:id", (req, res) => {
    const { name, account_id, capital, type, profit_target, loss_limit } = req.body;
    db.prepare(`
      UPDATE accounts 
      SET name = ?, account_id = ?, capital = ?, type = ?, profit_target = ?, loss_limit = ?
      WHERE id = ?
    `).run(name, account_id, capital, type, profit_target, loss_limit, req.params.id);
    res.json({ success: true });
  });

  // Strategy API Routes
  app.get("/api/strategies", (req, res) => {
    const strategies = db.prepare("SELECT * FROM strategies").all();
    res.json(strategies);
  });

  app.post("/api/strategies", (req, res) => {
    const { name, entry_triggers, exit_triggers, has_candlestick } = req.body;
    const info = db.prepare(`
      INSERT INTO strategies (name, entry_triggers, exit_triggers, has_candlestick)
      VALUES (?, ?, ?, ?)
    `).run(name, entry_triggers, exit_triggers, has_candlestick ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/strategies/:id", (req, res) => {
    const { name, entry_triggers, exit_triggers, has_candlestick } = req.body;
    db.prepare(`
      UPDATE strategies 
      SET name = ?, entry_triggers = ?, exit_triggers = ?, has_candlestick = ?
      WHERE id = ?
    `).run(name, entry_triggers, exit_triggers, has_candlestick ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/strategies/:id", (req, res) => {
    const id = req.params.id;
    // Set strategy_id to NULL in trades instead of deleting them to preserve trade history
    db.prepare("UPDATE trades SET strategy_id = NULL WHERE strategy_id = ?").run(id);
    db.prepare("DELETE FROM strategies WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Trade API Routes
  app.get("/api/trades", (req, res) => {
    const trades = db.prepare("SELECT * FROM trades ORDER BY entry_date DESC, entry_time DESC").all();
    res.json(trades);
  });

  app.post("/api/trades", (req, res) => {
    const { 
      account_id, strategy_id, instrument, entry_date, entry_time, lots, 
      entry_price, exit_price, sl, tp, type, comments, image_url,
      executed_entry_triggers, executed_exit_triggers, candlestick_used,
      riesgo_asumido_porcentaje, beneficio_obtenido_porcentaje, mae, mfe,
      riesgo_asumido_dinero
    } = req.body;
    
    let profit = 0;
    let status = 'OPEN';

    if (exit_price) {
      const multiplier = type === 'LONG' ? 1 : -1;
      profit = (exit_price - entry_price) * multiplier * lots * 100;
      status = profit > 0 ? 'WIN' : (profit < 0 ? 'LOSS' : 'BE');
    }

    const info = db.prepare(`
      INSERT INTO trades (
        account_id, strategy_id, instrument, entry_date, entry_time, lots, 
        entry_price, exit_price, sl, tp, profit, type, status, 
        comments, image_url, executed_entry_triggers, executed_exit_triggers, candlestick_used,
        riesgo_asumido_porcentaje, beneficio_obtenido_porcentaje, mae, mfe, riesgo_asumido_dinero
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      account_id, strategy_id, instrument, entry_date, entry_time, lots, 
      entry_price, exit_price, sl, tp, profit, type, status, 
      comments, image_url, executed_entry_triggers, executed_exit_triggers, candlestick_used,
      riesgo_asumido_porcentaje, beneficio_obtenido_porcentaje, mae, mfe, riesgo_asumido_dinero
    );

    res.json({ id: info.lastInsertRowid, profit, status });
  });

  app.delete("/api/trades/:id", (req, res) => {
    db.prepare("DELETE FROM trades WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/trades/:id", (req, res) => {
    const { 
      account_id, strategy_id, instrument, entry_date, entry_time, lots, 
      entry_price, exit_price, sl, tp, type, comments, image_url,
      executed_entry_triggers, executed_exit_triggers, candlestick_used,
      riesgo_asumido_porcentaje, beneficio_obtenido_porcentaje, mae, mfe,
      riesgo_asumido_dinero
    } = req.body;
    
    let profit = 0;
    let status = 'OPEN';

    if (exit_price) {
      const multiplier = type === 'LONG' ? 1 : -1;
      profit = (exit_price - entry_price) * multiplier * lots * 100;
      status = profit > 0 ? 'WIN' : (profit < 0 ? 'LOSS' : 'BE');
    }

    db.prepare(`
      UPDATE trades 
      SET account_id = ?, strategy_id = ?, instrument = ?, entry_date = ?, entry_time = ?, 
          lots = ?, entry_price = ?, exit_price = ?, sl = ?, tp = ?, profit = ?, 
          type = ?, status = ?, comments = ?, image_url = ?, executed_entry_triggers = ?, 
          executed_exit_triggers = ?, candlestick_used = ?,
          riesgo_asumido_porcentaje = ?, beneficio_obtenido_porcentaje = ?,
          mae = ?, mfe = ?, riesgo_asumido_dinero = ?
      WHERE id = ?
    `).run(
      account_id, strategy_id, instrument, entry_date, entry_time, lots, 
      entry_price, exit_price, sl, tp, profit, type, status, 
      comments, image_url, executed_entry_triggers, executed_exit_triggers, candlestick_used,
      riesgo_asumido_porcentaje, beneficio_obtenido_porcentaje, mae, mfe, riesgo_asumido_dinero,
      req.params.id
    );

    res.json({ success: true, profit, status });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

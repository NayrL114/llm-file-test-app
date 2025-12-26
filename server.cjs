require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json());

// ---- OpenAI client ----
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- SQLite init ----
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "history.db");
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS request_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    status TEXT NOT NULL,     -- pending/success/error
    error TEXT,
    duration_ms INTEGER
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO request_history (created_at, prompt, response, status, error, duration_ms)
  VALUES (@created_at, @prompt, @response, @status, @error, @duration_ms)
`);

const listStmt = db.prepare(`
  SELECT id, created_at, prompt, response, status, error, duration_ms
  FROM request_history
  ORDER BY id DESC
  LIMIT @limit
`);

const deleteOneStmt = db.prepare(`DELETE FROM request_history WHERE id = ?`);
const deleteAllStmt = db.prepare(`DELETE FROM request_history`);

// ---- API: call ChatGPT and persist ----
app.post("/api/chat", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });

  const createdAt = new Date().toISOString();
  const started = Date.now();

  try {
    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
    });

    const outputText = response.output_text || "";
    const durationMs = Date.now() - started;

    const info = insertStmt.run({
      created_at: createdAt,
      prompt,
      response: outputText,
      status: "success",
      error: null,
      duration_ms: durationMs,
    });

    return res.json({
      output: outputText,
      historyItem: {
        id: info.lastInsertRowid,
        created_at: createdAt,
        prompt,
        response: outputText,
        status: "success",
        error: null,
        duration_ms: durationMs,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - started;
    const msg = err?.message || "Server error calling OpenAI.";

    // Persist failures too (optional; remove if you only want successful calls stored)
    const info = insertStmt.run({
      created_at: createdAt,
      prompt,
      response: null,
      status: "error",
      error: msg,
      duration_ms: durationMs,
    });

    return res.status(500).json({
      error: msg,
      historyItem: {
        id: info.lastInsertRowid,
        created_at: createdAt,
        prompt,
        response: null,
        status: "error",
        error: msg,
        duration_ms: durationMs,
      },
    });
  }
});

// ---- API: load history on page load ----
app.get("/api/history", (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 1000);
  const rows = listStmt.all({ limit });
  res.json({ items: rows });
});

// ---- API: delete one history record ----
app.delete("/api/history/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id." });

  const info = deleteOneStmt.run(id);
  res.json({ deleted: info.changes > 0 });
});

// ---- API: clear all history ----
app.delete("/api/history", (req, res) => {
  deleteAllStmt.run();
  res.json({ ok: true });
});

app.listen(3001, () => console.log("API server running on http://localhost:3001"));

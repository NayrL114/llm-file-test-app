require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const Database = require("better-sqlite3");
const multer = require("multer");
const sharp = require("sharp");
const mammoth = require("mammoth");

const app = express();
app.use(express.json());

// --------------------
// OpenAI client
// --------------------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --------------------
// Local folders
// --------------------
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const commandsDir = path.join(__dirname, "commands");
fs.mkdirSync(commandsDir, { recursive: true });

// --------------------
// SQLite init
// --------------------
const dbPath = path.join(dataDir, "history.db");
const db = new Database(dbPath);

// Create the base table if it doesn't exist (original columns)
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

// Lightweight migration: add new columns if missing
function ensureColumn(name, type) {
  const cols = db.prepare(`PRAGMA table_info(request_history)`).all();
  const exists = cols.some((c) => c.name === name);
  if (!exists) db.exec(`ALTER TABLE request_history ADD COLUMN ${name} ${type}`);
}

ensureColumn("request_type", "TEXT");   // "chat" | "file"
ensureColumn("command_name", "TEXT");
ensureColumn("file_name", "TEXT");
ensureColumn("file_mime", "TEXT");
ensureColumn("file_size", "INTEGER");
ensureColumn("file_path", "TEXT");
ensureColumn("openai_file_id", "TEXT");
ensureColumn("result_json", "TEXT");

// --------------------
// Prepared statements
// --------------------
const insertChatStmt = db.prepare(`
  INSERT INTO request_history (
    created_at, request_type, prompt, response, status, error, duration_ms
  ) VALUES (
    @created_at, @request_type, @prompt, @response, @status, @error, @duration_ms
  )
`);

const insertFileStmt = db.prepare(`
  INSERT INTO request_history (
    created_at, request_type, prompt, response, status, error, duration_ms,
    command_name, file_name, file_mime, file_size, file_path, openai_file_id, result_json
  ) VALUES (
    @created_at, @request_type, @prompt, @response, @status, @error, @duration_ms,
    @command_name, @file_name, @file_mime, @file_size, @file_path, @openai_file_id, @result_json
  )
`);

const listStmt = db.prepare(`
  SELECT
    id,
    created_at,
    COALESCE(request_type, 'chat') AS request_type,
    prompt,
    response,
    status,
    error,
    duration_ms,
    command_name,
    file_name,
    file_mime,
    file_size,
    openai_file_id,
    result_json
  FROM request_history
  ORDER BY id DESC
  LIMIT @limit
`);

const getOneForDeleteStmt = db.prepare(`
  SELECT id, file_path
  FROM request_history
  WHERE id = ?
`);

const deleteOneStmt = db.prepare(`DELETE FROM request_history WHERE id = ?`);
const deleteAllStmt = db.prepare(`DELETE FROM request_history`);

const listFilePathsStmt = db.prepare(`
  SELECT file_path
  FROM request_history
  WHERE file_path IS NOT NULL AND file_path <> ''
`);

// --------------------
// Multer upload config
// --------------------
function safeFilename(originalname) {
  const ext = path.extname(originalname || "").toLowerCase();
  const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${base}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
});

// 50MB cap (aligns with common OpenAI file size constraints and good hygiene)
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function loadCommandSpec(commandFile = "extract-v1.json") {
  // prevent path traversal; only allow filename
  const safe = path.basename(commandFile);
  const cmdPath = path.join(commandsDir, safe);

  if (!fs.existsSync(cmdPath)) {
    throw new Error(
      `Command spec not found: ${safe}. Create it under ./commands/${safe}`
    );
  }

  const raw = fs.readFileSync(cmdPath, "utf8");
  const cmd = JSON.parse(raw);

  if (!cmd.schema || !cmd.schema_name) {
    throw new Error(
      `Command spec ${safe} must include "schema_name" and "schema" for JSON extraction.`
    );
  }

  return cmd;
}

// Utilities
function asDataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function isImageExtOrMime(ext, mime) {
  const e = (ext || "").toLowerCase();
  return (
    mime?.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(e)
  );
}

// --------------------
// API: chat (existing)
// --------------------
app.post("/api/chat", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? "").trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt." });

    const createdAt = new Date().toISOString();
    const startedAt = Date.now();

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
    });

    const outputText = response.output_text || "";
    const durationMs = Date.now() - startedAt;

    const info = insertChatStmt.run({
      created_at: createdAt,
      request_type: "chat",
      prompt,
      response: outputText,
      status: "success",
      error: null,
      duration_ms: durationMs,
    });

    res.json({
      output: outputText,
      historyItem: {
        id: info.lastInsertRowid,
        created_at: createdAt,
        request_type: "chat",
        prompt,
        response: outputText,
        status: "success",
        error: null,
        duration_ms: durationMs,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error calling OpenAI." });
  }
});

// --------------------
// API: analyze file (NEW)
// --------------------
//
// Frontend should send multipart/form-data:
// - field name: "file"
// - optional field: "command" (e.g. extract-v1.json)
//
app.post("/api/analyze-file", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Missing file." });

  const createdAt = new Date().toISOString();
  const startedAt = Date.now();

  let cmd;
  try {
    const commandFile = req.body?.command ? String(req.body.command) : "extract-v1.json";
    cmd = loadCommandSpec(commandFile);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Invalid command spec." });
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";

  // Allow only your stated types
  const isPdf = ext === ".pdf" || mime === "application/pdf";
  const isDocx =
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isTxt = ext === ".txt" || mime.startsWith("text/");
  const isImg = isImageExtOrMime(ext, mime);

  if (!isPdf && !isDocx && !isTxt && !isImg) {
    return res.status(400).json({
      error: `Unsupported file type. Allowed: PDF, DOCX, TXT, JPG/PNG/WEBP/AVIF.`,
    });
  }

  let openaiFileId = null;

  try {
    // Build content parts for Responses
    const contentParts = [];

    if (isPdf) {
      // Upload PDF to OpenAI and reference by file_id
      const uploaded = await client.files.create({
        file: fs.createReadStream(file.path),
        purpose: "user_data",
      });
      openaiFileId = uploaded.id;

      contentParts.push({ type: "input_file", file_id: openaiFileId });
    } else if (isDocx) {
      // Extract DOCX text server-side
      const result = await mammoth.extractRawText({ path: file.path });
      const text = (result.value || "").trim();
      contentParts.push({
        type: "input_text",
        text: text || "(DOCX contained no extractable text.)",
      });
    } else if (isTxt) {
      // Read text file
      const text = fs.readFileSync(file.path, "utf8");
      contentParts.push({ type: "input_text", text });
    } else if (isImg) {
      // Image: normalize WEBP/AVIF to PNG for better downstream handling
      let buf = fs.readFileSync(file.path);
      let outMime = mime;

      if (ext === ".webp" || ext === ".avif" || mime === "image/webp" || mime === "image/avif") {
        buf = await sharp(buf).png().toBuffer();
        outMime = "image/png";
      } else if (mime === "image/jpg") {
        outMime = "image/jpeg";
      }

      // Send image as base64 data URL
      contentParts.push({
        type: "input_image",
        image_url: asDataUrl(buf, outMime || "image/png"),
      });
    }

    // Append command prompt from backend
    contentParts.push({
      type: "input_text",
      text: cmd.user_prompt || "Extract the required information from the provided input.",
    });

    const response = await client.responses.create({
      model: cmd.model || "gpt-4o-mini",
      instructions: cmd.system || "Return only JSON matching the provided schema.",
      input: [{ role: "user", content: contentParts }],
      text: {
        format: {
          type: "json_schema",
          name: cmd.schema_name || "extraction_result",
          strict: true,
          schema: cmd.schema,
        },
      },
    });

    const durationMs = Date.now() - startedAt;

    const jsonText = response.output_text || "{}";
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = { _raw: jsonText };
    }

    const info = insertFileStmt.run({
      created_at: createdAt,
      request_type: "file",
      prompt: `Analyze file: ${file.originalname}`,
      response: null,
      status: "success",
      error: null,
      duration_ms: durationMs,
      command_name: cmd.name || path.basename(req.body?.command || "extract-v1.json"),
      file_name: file.originalname,
      file_mime: mime,
      file_size: file.size,
      file_path: file.path,
      openai_file_id: openaiFileId,
      result_json: JSON.stringify(parsed),
    });

    res.json({
      result: parsed,
      historyItem: {
        id: info.lastInsertRowid,
        created_at: createdAt,
        request_type: "file",
        prompt: `Analyze file: ${file.originalname}`,
        status: "success",
        error: null,
        duration_ms: durationMs,
        command_name: cmd.name || path.basename(req.body?.command || "extract-v1.json"),
        file_name: file.originalname,
        file_mime: mime,
        file_size: file.size,
        openai_file_id: openaiFileId,
        result_json: JSON.stringify(parsed),
      },
    });
  } catch (err) {
    console.error(err);
    const durationMs = Date.now() - startedAt;

    // Store error run too (so it appears in history)
    try {
      const info = insertFileStmt.run({
        created_at: createdAt,
        request_type: "file",
        prompt: `Analyze file: ${file.originalname}`,
        response: null,
        status: "error",
        error: err?.message || "Analyze failed.",
        duration_ms: durationMs,
        command_name: cmd?.name || path.basename(req.body?.command || "extract-v1.json"),
        file_name: file.originalname,
        file_mime: mime,
        file_size: file.size,
        file_path: file.path,
        openai_file_id: openaiFileId,
        result_json: null,
      });

      return res.status(500).json({
        error: err?.message || "Analyze failed.",
        historyItem: {
          id: info.lastInsertRowid,
          created_at: createdAt,
          request_type: "file",
          prompt: `Analyze file: ${file.originalname}`,
          status: "error",
          error: err?.message || "Analyze failed.",
          duration_ms: durationMs,
          command_name: cmd?.name || path.basename(req.body?.command || "extract-v1.json"),
          file_name: file.originalname,
          file_mime: mime,
          file_size: file.size,
          openai_file_id: openaiFileId,
          result_json: null,
        },
      });
    } catch (dbErr) {
      console.error("Failed to persist error history:", dbErr);
      return res.status(500).json({ error: err?.message || "Analyze failed." });
    }
  }
});

// --------------------
// API: load history
// --------------------
app.get("/api/history", (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 1000);
  const rows = listStmt.all({ limit });
  res.json({ items: rows });
});

// --------------------
// API: delete one history record (also deletes uploaded file if present)
// --------------------
app.delete("/api/history/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id." });

  const row = getOneForDeleteStmt.get(id);
  if (row?.file_path) {
    try {
      if (fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
    } catch (e) {
      // Non-fatal; we still delete DB row
      console.error("Failed to delete local upload:", e);
    }
  }

  const info = deleteOneStmt.run(id);
  res.json({ deleted: info.changes > 0 });
});

// --------------------
// API: clear all history (also deletes all uploaded files recorded in DB)
// --------------------
app.delete("/api/history", (req, res) => {
  const fileRows = listFilePathsStmt.all();
  for (const r of fileRows) {
    if (!r.file_path) continue;
    try {
      if (fs.existsSync(r.file_path)) fs.unlinkSync(r.file_path);
    } catch (e) {
      console.error("Failed to delete local upload:", e);
    }
  }

  deleteAllStmt.run();
  res.json({ ok: true });
});

app.listen(3001, () => console.log("API server running on http://localhost:3001"));

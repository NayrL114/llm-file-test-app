const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });


const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
// ...rest unchanged

const Database = require("better-sqlite3");
const multer = require("multer");
const sharp = require("sharp");
const mammoth = require("mammoth");

const app = express();
app.use(express.json({ limit: "2mb" }));

// --------------------
// OpenAI client
// --------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------------------
// Directories
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

db.exec(`
  CREATE TABLE IF NOT EXISTS request_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    request_type TEXT NOT NULL,
    prompt TEXT,
    response TEXT,
    status TEXT NOT NULL,
    error TEXT,
    duration_ms INTEGER,
    command_name TEXT,
    file_name TEXT,
    file_mime TEXT,
    file_size INTEGER,
    file_path TEXT,
    openai_file_id TEXT,
    result_json TEXT
  );
`);

const insertChatStmt = db.prepare(`
  INSERT INTO request_history (created_at, request_type, prompt, response, status, error, duration_ms)
  VALUES (@created_at, @request_type, @prompt, @response, @status, @error, @duration_ms)
`);

const insertFileStmt = db.prepare(`
  INSERT INTO request_history (created_at, request_type, prompt, response, status, error, duration_ms,
                               command_name, file_name, file_mime, file_size, file_path, openai_file_id, result_json)
  VALUES (@created_at, @request_type, @prompt, @response, @status, @error, @duration_ms,
          @command_name, @file_name, @file_mime, @file_size, @file_path, @openai_file_id, @result_json)
`);

const listStmt = db.prepare(`
  SELECT *
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

// --- Fix mojibake filenames (UTF-8 bytes mis-decoded as latin1/win1252) ---
// This is common for multipart "filename" headers, especially on Windows.
// Strategy:
// 1) If string already contains CJK, return as-is.
// 2) Try reversing latin1->utf8.
// 3) Try reversing Windows-1252->utf8 (handles the \u02DC "˜" case, etc.).
// Only accept a decoded result if it introduces CJK characters (safe for Chinese filenames).
const WIN1252_UNICODE_TO_BYTE = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function hasCJK(s) {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(String(s));
}

function encodeWin1252Bytes(str) {
  const s = String(str || "");
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0xff) {
      bytes[i] = code;
      continue;
    }
    const mapped = WIN1252_UNICODE_TO_BYTE[code];
    if (mapped === undefined) return null;
    bytes[i] = mapped;
  }
  return bytes;
}

function normalizeFilename(name) {
  if (!name) return name;

  const s = String(name);
  if (hasCJK(s)) return s;

  // Try latin1 -> utf8 (most common)
  try {
    const decoded = Buffer.from(s, "latin1").toString("utf8");
    if (hasCJK(decoded)) return decoded;
  } catch {
    // ignore
  }

  // Try Windows-1252 -> utf8 (handles U+02DC, smart quotes, etc.)
  try {
    const bytes = encodeWin1252Bytes(s);
    if (bytes) {
      const decoded = Buffer.from(bytes).toString("utf8");
      if (hasCJK(decoded)) return decoded;
    }
  } catch {
    // ignore
  }

  return s;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, safeFilename(normalizeFilename(file.originalname))),
});

// 50MB cap (aligns with common OpenAI file size constraints and good hygiene)
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// --------------------
// Command loader
// --------------------
function loadCommand(commandName) {
  const safe = path.basename(commandName);
  const cmdPath = path.join(commandsDir, safe);
  if (!fs.existsSync(cmdPath)) {
    throw new Error(`Command file not found: ${safe}`);
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
  const b64 = buffer.toString("base64");
  return `data:${mime};base64,${b64}`;
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
    //const commandFile = req.body?.command ? String(req.body.command) : "extract-v1.json";
    const commandFile = req.body?.command ? String(req.body.command) : "extract-v1.json";
    cmd = loadCommand(commandFile);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // normalize original filename (fix mojibake)
  const originalName = normalizeFilename(String(file.originalname || ""));

  //const ext = path.extname(file.originalname || "").toLowerCase();
  const ext = path.extname(originalName || "").toLowerCase();
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

  // Build content parts for OpenAI Responses API (input_file / input_text / input_image)
  const contentParts = [];
  let openaiFileId = null;

  try {
    if (isPdf) {
      // Upload file to OpenAI
      const uploaded = await client.files.create({
        file: fs.createReadStream(file.path),
        purpose: "assistants",
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
      prompt: `Analyze file: ${originalName}`,
      response: null,
      status: "success",
      error: null,
      duration_ms: durationMs,
      //command_name: cmd.name || path.basename(req.body?.command || "extract-v1.json"),
      command_name: cmd.name || "extract-v1.json",
      file_name: originalName,
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
        prompt: `Analyze file: ${originalName}`,
        status: "success",
        error: null,
        duration_ms: durationMs,
        command_name: cmd.name || path.basename(req.body?.command || "extract-v1.json"),
        file_name: originalName,
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
        prompt: `Analyze file: ${originalName}`,
        response: null,
        status: "error",
        error: err?.message || "Analyze failed.",
        duration_ms: durationMs,
        command_name: cmd?.name || path.basename(req.body?.command || "extract-v1.json"),
        file_name: originalName,
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
          prompt: `Analyze file: ${originalName}`,
          status: "error",
          error: err?.message || "Analyze failed.",
          duration_ms: durationMs,
          command_name: cmd?.name || path.basename(req.body?.command || "extract-v1.json"),
          file_name: originalName,
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
// API: history list
// --------------------
app.get("/api/history", (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 1000);
  const rows = listStmt.all({ limit });

  // Repair already-saved mojibake rows at read-time (so old entries display correctly too)
  const fixed = rows.map((r) => {
    const out = { ...r };

    if (out.file_name) out.file_name = normalizeFilename(String(out.file_name));

    // If prompt follows your own template, repair the embedded filename too
    if (typeof out.prompt === "string" && out.prompt.startsWith("Analyze file: ")) {
      const namePart = out.prompt.slice("Analyze file: ".length);
      out.prompt = `Analyze file: ${normalizeFilename(String(namePart))}`;
    }

    return out;
  });

  res.json({ items: fixed });
});

// --------------------
// API: delete single history item
// --------------------
app.delete("/api/history/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = getOneForDeleteStmt.get(id);
  if (!row) return res.status(404).json({ error: "Not found." });

  // delete local upload if present
  if (row.file_path) {
    try {
      if (fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
    } catch (e) {
      console.error("Failed to delete local upload:", e);
    }
  }

  deleteOneStmt.run(id);
  res.json({ ok: true });
});

// --------------------
// API: clear all history
// --------------------
app.delete("/api/history", (req, res) => {
  // delete all uploaded files tracked in DB
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

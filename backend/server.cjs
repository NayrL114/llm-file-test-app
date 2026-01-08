const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");

const Database = require("better-sqlite3");
const multer = require("multer");
const sharp = require("sharp");
const mammoth = require("mammoth");

// Use global fetch when available (Node 18+). If not available, provider calls will error with instructions.
const fetch = globalThis.fetch;
if (!fetch) {
  console.warn(
    "Global fetch not available. Claude/Gemini provider calls require Node 18+ (or a fetch polyfill). Set up a global fetch or install a compatible fetch polyfill."
  );
}

// Provider API keys (set in backend/.env or environment)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Optional provider model overrides
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.5-flash";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5.2";

const app = express();
app.use(express.json({ limit: "2mb" }));

// --------------------
// OpenAI client for ChatGPT prompts and file analysis
// --------------------
//
// This client is used for both:
// - plain chat calls (callGPT)
// - schema-enforced extraction calls (callGPTWithJsonSchema)
//
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
    model TEXT,
    result_json TEXT
  );
`);

// Ensure 'model' column exists for older databases (migration)
try {
  const cols = db.prepare("PRAGMA table_info(request_history)").all();
  const hasModelColumn = cols.some((c) => c && c.name === "model");
  if (!hasModelColumn) {
    db.exec(`ALTER TABLE request_history ADD COLUMN model TEXT`);
  }
} catch (e) {
  // If migration fails, log but continue — DB will still operate without the column.
  console.error("Failed to ensure 'model' column exists:", e);
}

const insertChatStmt = db.prepare(`
  INSERT INTO request_history (created_at, request_type, prompt, response, status, error, duration_ms, model)
  VALUES (@created_at, @request_type, @prompt, @response, @status, @error, @duration_ms, @model)
`);

const insertFileStmt = db.prepare(`
  INSERT INTO request_history (created_at, request_type, prompt, response, status, error, duration_ms,
                               command_name, file_name, file_mime, file_size, file_path, openai_file_id, model, result_json)
  VALUES (@created_at, @request_type, @prompt, @response, @status, @error, @duration_ms,
          @command_name, @file_name, @file_mime, @file_size, @file_path, @openai_file_id, @model, @result_json)
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
// Provider helpers
// --------------------

/**
 * Claude (Anthropic) provider caller.
 * Uses the modern Messages API endpoint.
 */
async function callAnthropic(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (typeof fetch !== "function") {
    throw new Error(
      "Global fetch is not available in this Node runtime; install a fetch polyfill or use Node 18+ to use Anthropic provider."
    );
  }

  const url = "https://api.anthropic.com/v1/messages";
  const model = ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  const body = {
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: String(prompt),
      },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01", // Required header
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Anthropic API error: ${resp.status} ${txt}`);
  }

  const json = await resp.json();

  // Modern API returns content in this structure
  if (json.content && Array.isArray(json.content) && json.content.length > 0) {
    return json.content[0].text || "";
  }

  // Fallback
  return JSON.stringify(json);
}

/**
 * Gemini (Google) provider caller.
 * Uses v1beta generateContent endpoint (current for many Gemini SDK-less integrations).
 */
async function callGemini(prompt) {
  if (!GOOGLE_API_KEY) throw new Error("Missing GOOGLE_API_KEY");
  if (typeof fetch !== "function")
    throw new Error("Global fetch is not available. Use Node 18+");

  const model = GOOGLE_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: String(prompt) }],
      },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Google Gemini API error: ${resp.status} ${text}`);
  }

  const json = JSON.parse(text);

  // Gemini response structure: candidates[0].content.parts[0].text
  if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
    return json.candidates[0].content.parts[0].text;
  }

  return JSON.stringify(json);
}

// --------------------
// OpenAI (ChatGPT) helpers
// --------------------
//
// We keep OpenAI calls behind a single callGPT(...) function so the rest of the
// server can route providers consistently (callAnthropic / callGemini / callGPT).
//
// Notes:
// - This project uses the OpenAI "Responses API" (client.responses.create).
// - For chat: we pass a simple text prompt and return response.output_text.
// - For file analysis: we pass structured "input" content parts and enforce a JSON schema.

/**
 * Call OpenAI for a plain-text chat completion (Responses API).
 * @param {string} prompt
 * @param {{model?: string}} [opts]
 * @returns {Promise<string>}
 */
async function callGPT(prompt, opts = {}) {
  const model = opts.model || OPENAI_CHAT_MODEL;

  // Basic hygiene: ensure we always pass a string to the SDK.
  const input = String(prompt ?? "");

  const response = await client.responses.create({
    model,
    input,
  });

  return response.output_text || "";
}

/**
 * Call OpenAI for JSON extraction using a command spec (schema + system prompt).
 * This wraps the Responses API json_schema format so the route stays clean.
 *
 * @param {object} cmd - Loaded command JSON (must include schema_name + schema)
 * @param {Array} contentParts - Responses API content parts (input_file / input_text / input_image)
 * @returns {Promise<{jsonText: string, parsed: any, responseId?: string}>}
 */
async function callGPTWithJsonSchema(cmd, contentParts) {
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

  const jsonText = response.output_text || "{}";

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // If the model ever returns non-JSON, keep the raw response for debugging.
    parsed = { _raw: jsonText };
  }

  return { jsonText, parsed, responseId: response.id };
}

/**
 * NEW: Implementation for Google Gemini using response_schema.
 */
// --- UPDATED Gemini Helper ---
async function callGeminiWithJsonSchema(cmd, parts) {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured.");

  const geminiParts = [];
  for (const part of parts) {
    if (part.type === "input_text") {
      geminiParts.push({ text: part.text });
    } else if (part.type === "input_image") {
      const [header, b64] = part.image_url.split(",");
      const mime = header.split(";")[0].split(":")[1];
      geminiParts.push({ inline_data: { mime_type: mime, data: b64 } });
    } else if (part.type === "input_file" && part.localPath) {
      // FIX: Read the actual file bytes from the upload directory
      const fileBuffer = fs.readFileSync(part.localPath);
      geminiParts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: fileBuffer.toString("base64"),
        },
      });
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: cmd.system }] },
      contents: [{ role: "user", parts: geminiParts }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: cmd.schema, // Uses the schema from resume-extract-v1.json
      },
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Gemini API Error: ${data.error.message}`);
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return { output: JSON.parse(text) };
}

/**
 * NEW: Implementation for Anthropic (Claude) using Structured Outputs.
 * This uses the 'output_format' beta feature.
 */
async function callClaudeWithJsonSchema(cmd, parts) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const messages = [{
    role: "user",
    content: parts.map(p => {
      if (p.type === "input_text") {
        return { type: "text", text: p.text };
      }
      if (p.type === "input_image") {
        const [header, b64] = p.image_url.split(",");
        const mime = header.split(";")[0].split(":")[1];
        return { 
          type: "image", 
          source: { type: "base64", media_type: mime, data: b64 } 
        };
      }
      if (p.type === "input_file" && p.localPath) {
        const fileBuffer = fs.readFileSync(p.localPath);
        return {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fileBuffer.toString("base64")
          }
        };
      }
      return null;
    }).filter(Boolean)
  }];

  const url = "https://api.anthropic.com/v1/messages";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: cmd.system,
      messages: messages,
      max_tokens: 4096,
      tools: [{
        name: "extract_resume",
        description: "Extract structured resume information from the document",
        input_schema: cmd.schema
      }],
      tool_choice: { type: "tool", name: "extract_resume" }
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Claude API Error: ${data.error.message}`);
  
  // Find the tool use in the response
  const toolUse = data.content.find(block => block.type === "tool_use");
  if (!toolUse) {
    throw new Error("Claude did not return a tool use response");
  }
  
  return { output: toolUse.input };
}

// --------------------
// API: chat (supports model selection)
// --------------------
//
// Frontend should send JSON:
// - prompt: string
// - model: 'chatgpt' | 'gemini' | 'claude'   (optional, defaults to 'chatgpt')
//
/**
 * UPDATED: The /api/analyze-file route now switches based on the provider.
 */
// --------------------
// API: chat (supports model selection)
// --------------------
//
// Frontend should send JSON:
// - prompt: string
// - model: 'chatgpt' | 'gemini' | 'claude'   (optional, defaults to 'chatgpt')
//
app.post("/api/chat", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? "").trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt." });

    // model key expected from frontend: 'chatgpt', 'gemini', or 'claude'. Default to chatgpt for legacy calls.
    const modelKey = String(req.body?.model || "chatgpt");

    const createdAt = new Date().toISOString();
    const startedAt = Date.now();

    // Route to provider-specific callers
    let outputText = "";
    try {
      if (modelKey === "claude") {
        outputText = await callAnthropic(prompt);
      } else if (modelKey === "gemini") {
        outputText = await callGemini(prompt);
      } else {
        // Default / ChatGPT via OpenAI
        outputText = await callGPT(prompt);
      }
    } catch (provErr) {
      const durationMs = Date.now() - startedAt;

      // Persist error run
      const infoErr = insertChatStmt.run({
        created_at: createdAt,
        request_type: "chat",
        prompt,
        response: null,
        status: "error",
        error: provErr?.message || String(provErr),
        duration_ms: durationMs,
        model: modelKey,
      });

      console.error("Provider call failed:", provErr);
      return res.status(500).json({
        error: provErr?.message || "Provider call failed.",
        historyItem: {
          id: infoErr.lastInsertRowid,
          created_at: createdAt,
          request_type: "chat",
          prompt,
          status: "error",
          error: provErr?.message || String(provErr),
          duration_ms: durationMs,
          model: modelKey,
        },
      });
    }

    const durationMs = Date.now() - startedAt;

    const info = insertChatStmt.run({
      created_at: createdAt,
      request_type: "chat",
      prompt,
      response: outputText,
      status: "success",
      error: null,
      duration_ms: durationMs,
      model: modelKey,
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
        model: modelKey,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error calling provider." });
  }
});


// --------------------
// API: analyze file
// --------------------
//
// Frontend should send multipart/form-data:
// - field name: "file"
// - optional field: "command" (e.g. extract-v1.json)
//
// --------------------
// API: analyze file
// --------------------
app.post("/api/analyze-file", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Missing file." });

  const createdAt = new Date().toISOString();
  const startedAt = Date.now();

  let cmd;
  try {
    const commandFile = req.body?.command || "resume-extract-v1.json";
    const commandFileSafe = path.basename(commandFile);
    cmd = loadCommand(commandFileSafe);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const provider = req.body?.provider || "openai";
  const originalName = normalizeFilename(String(file.originalname || ""));
  const ext = path.extname(originalName || "").toLowerCase();
  const mime = file.mimetype || "";

  // Validate file type
  const isPdf = ext === ".pdf" || mime === "application/pdf";
  const isDocx = ext === ".docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isTxt = ext === ".txt" || mime.startsWith("text/");
  const isImg = isImageExtOrMime(ext, mime);

  if (!isPdf && !isDocx && !isTxt && !isImg) {
    return res.status(400).json({
      error: `Unsupported file type. Allowed: PDF, DOCX, TXT, JPG/PNG/WEBP/AVIF.`,
    });
  }

  let contentParts = [{ type: "input_text", text: cmd.user_prompt }];
  let openaiFileId = null;

  try {
    // Handle different file types
    if (isPdf) {
      if (provider === "openai") {
        const uploaded = await client.files.create({
          file: fs.createReadStream(file.path),
          purpose: "assistants",
        });
        openaiFileId = uploaded.id;
        contentParts.push({ type: "input_file", file_id: openaiFileId });
      } else {
        // For Gemini and Claude, pass localPath
        contentParts.push({ type: "input_file", localPath: file.path });
      }
    } else if (isDocx) {
      const result = await mammoth.extractRawText({ path: file.path });
      const text = (result.value || "").trim();
      contentParts.push({
        type: "input_text",
        text: text || "(DOCX contained no extractable text.)",
      });
    } else if (isTxt) {
      const text = fs.readFileSync(file.path, "utf8");
      contentParts.push({ type: "input_text", text });
    } else if (isImg) {
      let buf = fs.readFileSync(file.path);
      let outMime = mime;

      if (ext === ".webp" || ext === ".avif" || mime === "image/webp" || mime === "image/avif") {
        buf = await sharp(buf).png().toBuffer();
        outMime = "image/png";
      } else if (mime === "image/jpg") {
        outMime = "image/jpeg";
      }

      contentParts.push({
        type: "input_image",
        image_url: asDataUrl(buf, outMime || "image/png"),
      });
    }

    // Call the appropriate provider
    let result;
    if (provider === "gemini") {
      result = await callGeminiWithJsonSchema(cmd, contentParts);
    } else if (provider === "claude") {
      result = await callClaudeWithJsonSchema(cmd, contentParts);
    } else {
      const response = await callGPTWithJsonSchema(cmd, contentParts);
      result = { output: response.parsed };
    }

    const durationMs = Date.now() - startedAt;

    // Save to database
    const info = insertFileStmt.run({
      created_at: createdAt,
      request_type: "file",
      prompt: `Analyze file: ${originalName}`,
      response: null,
      status: "success",
      error: null,
      duration_ms: durationMs,
      command_name: cmd.name || "resume-extract-v1",
      file_name: originalName,
      file_mime: mime,
      file_size: file.size,
      file_path: file.path,
      openai_file_id: openaiFileId,
      model: provider,
      result_json: JSON.stringify(result.output),
    });

    res.json({
      result: result.output,
      historyItem: {
        id: info.lastInsertRowid,
        created_at: createdAt,
        request_type: "file",
        prompt: `Analyze file: ${originalName}`,
        status: "success",
        error: null,
        duration_ms: durationMs,
        command_name: cmd.name || "resume-extract-v1",
        model: provider,
        file_name: originalName,
        file_mime: mime,
        file_size: file.size,
        openai_file_id: openaiFileId,
        result_json: JSON.stringify(result.output),
      },
    });
  } catch (err) {
    console.error("Analysis Error:", err);
    const durationMs = Date.now() - startedAt;

    // Store error in history
    try {
      const info = insertFileStmt.run({
        created_at: createdAt,
        request_type: "file",
        prompt: `Analyze file: ${originalName}`,
        response: null,
        status: "error",
        error: err?.message || "Analyze failed.",
        duration_ms: durationMs,
        command_name: cmd?.name || "resume-extract-v1",
        file_name: originalName,
        file_mime: mime,
        file_size: file.size,
        file_path: file.path,
        openai_file_id: openaiFileId,
        model: provider,
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
          command_name: cmd?.name || "resume-extract-v1",
          model: provider,
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
  } finally {
    // Clean up uploaded file
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
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

// Validate runtime configuration and warn about missing keys or inconsistent settings
function validateConfig() {
  const warnings = [];

  if (!process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY is not set. OpenAI-based ChatGPT calls will fail.");
  }

  if (process.env.OPENAI_CHAT_MODEL && !process.env.OPENAI_API_KEY) {
    warnings.push(
      "OPENAI_CHAT_MODEL is set but OPENAI_API_KEY is not set — ChatGPT provider will not work without the key."
    );
  }

  if (ANTHROPIC_API_KEY && typeof fetch !== "function") {
    warnings.push(
      "ANTHROPIC_API_KEY is set but global fetch is not available in this Node runtime. Install a fetch polyfill or use Node 18+ to enable Anthropic (Claude) provider."
    );
  }

  if (GOOGLE_API_KEY && typeof fetch !== "function") {
    warnings.push(
      "GOOGLE_API_KEY is set but global fetch is not available in this Node runtime. Install a fetch polyfill or use Node 18+ to enable Google Gemini provider."
    );
  }

  if (ANTHROPIC_MODEL && !ANTHROPIC_API_KEY) {
    warnings.push(
      "ANTHROPIC_MODEL is set but ANTHROPIC_API_KEY is not set — Claude provider will not work without the key."
    );
  }

  if (GOOGLE_MODEL && !GOOGLE_API_KEY) {
    warnings.push(
      "GOOGLE_MODEL is set but GOOGLE_API_KEY is not set — Gemini provider will not work without the key."
    );
  }

  if (!ANTHROPIC_API_KEY && !GOOGLE_API_KEY && !process.env.OPENAI_API_KEY) {
    warnings.push(
      "No provider API keys are configured. The server will not be able to make external model calls."
    );
  }

  if (warnings.length > 0) {
    console.warn("\n=== Configuration warnings ===");
    for (const w of warnings) console.warn("- " + w);
    console.warn("=== End configuration warnings ===\n");
  } else {
    console.log("Configuration OK: provider keys and runtime sanity checks passed.");
  }
}

validateConfig();

app.listen(3001, () => console.log("API server running on http://localhost:3001"));

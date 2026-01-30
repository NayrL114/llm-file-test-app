# GPT Agent Repository Review

**Review Timestamp:** 2026-01-30 14:22:00

## High-Level Summary

This repo is a React + Vite frontend with a Node/Express backend in a simple monorepo (npm workspaces). The app exposes two primary user flows: a multi-model Chat Console and a Resume Extractor that performs schema-based extraction from uploaded files. The Resume Extractor was recently expanded to a v2 schema (new Work Experience, Education, and License/Certificate sections with validation) and now defaults to the v2 extraction command. The backend proxies requests to OpenAI, Gemini, and Claude, and persists all requests in a SQLite history database.

## Backend (`backend/server.cjs`)

- **Runtime:** Express server on port 3001 with JSON body parsing.
- **Persistence:** `better-sqlite3` database at `backend/data/history.db` with a `request_history` table.
- **Providers:** OpenAI SDK (Responses API) plus direct `fetch` calls to Gemini and Claude.
- **File pipeline:** `multer` uploads to `backend/uploads`, with PDF, DOCX, TXT, and image handling. DOCX uses `mammoth`, images use `sharp`.
- **Schema extraction:** Command specs in `backend/commands/*.json` define prompts and JSON schema for structured extraction (resume-extract-v2 is now the default command).
- **Command parsing:** Command JSON is sanitized for UTF-8 BOMs before parsing.
- **API routes:**
  - `POST /api/chat` (model selection)
  - `POST /api/analyze-file` (schema-based file extraction)
  - `GET /api/history`
  - `DELETE /api/history/:id`
  - `DELETE /api/history`

## Frontend (`frontend/`)

- **Framework:** React SPA built with Vite.
- **Routing:** `react-router-dom` with two pages: Chat Console and Resume Extract.
- **Chat Console:** Sends prompts to selected models, shows per-model output, and lists chat history.
- **Resume Extract:** Uploads files for extraction, displays editable structured output, and lists file history. The form now includes Work Experience, Education, and License/Certificate sections, with required-field validation, date pickers, and conditional end-date/checkbox behavior.
- **Dev proxy:** `/api` proxied to `http://localhost:3001` via `frontend/vite.config.js`.

## Overall Architecture

Classic client–server split: the React frontend calls REST endpoints on the Express backend. The backend handles model routing, file parsing, and persistence, while the frontend focuses on UI/UX for chat and resume extraction.

## Custom Instructions
Start the reply with the word "Acknowledged".

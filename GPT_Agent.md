# GPT Agent Repository Review

**Review Timestamp:** 2026-01-30 16:10:00

## High-Level Summary

This repo is a React + Vite frontend with a Node/Express backend in a simple monorepo (npm workspaces). The app now exposes three primary user flows: a multi-model Chat Console, a Resume Extractor that performs schema-based extraction from uploaded files, and a Settings page for provider API key management and night-mode theming. The Resume Extractor uses the v2 schema (Work Experience, Education, and License/Certificate sections with validation) and defaults to the v2 extraction command. The backend proxies requests to OpenAI, Gemini, and Claude, persists all requests in a SQLite history database, and can update backend `.env` provider keys via an API endpoint.

## Backend (`backend/server.cjs`)

- **Runtime:** Express server on port 3001 with JSON body parsing.
- **Persistence:** `better-sqlite3` database at `backend/data/history.db` with a `request_history` table.
- **Providers:** OpenAI SDK (Responses API) plus direct `fetch` calls to Gemini and Claude.
- **File pipeline:** `multer` uploads to `backend/uploads`, with PDF, DOCX, TXT, and image handling. DOCX uses `mammoth`, images use `sharp`.
- **Schema extraction:** Command specs in `backend/commands/*.json` define prompts and JSON schema for structured extraction (resume-extract-v2 is now the default command).
- **Command parsing:** Command JSON is sanitized for UTF-8 BOMs before parsing.
- **API routes:**
  - `POST /api/chat` (model selection)
  - `POST /api/settings/keys` (update provider API keys in `backend/.env`)
  - `POST /api/analyze-file` (schema-based file extraction)
  - `GET /api/history`
  - `DELETE /api/history/:id`
  - `DELETE /api/history`

## Frontend (`frontend/`)

- **Framework:** React SPA built with Vite.
- **Routing:** `react-router-dom` with three pages: Chat Console, Resume Extract, and Settings.
- **Chat Console:** Sends prompts to selected models, shows per-model output, and lists chat history.
- **Resume Extract:** Uploads files for extraction, displays editable structured output, and lists file history. The form now includes Work Experience, Education, and License/Certificate sections, with required-field validation, date pickers, and conditional end-date/checkbox behavior.
- **Settings:** Allows users to save provider API keys (OpenAI, Claude, Gemini) to `backend/.env` and toggle night mode.
- **Theming:** CSS variable-based light/dark palettes are applied via a `data-theme` attribute, with night-mode state persisted in `localStorage`.
- **Dev proxy:** `/api` proxied to `http://localhost:3001` via `frontend/vite.config.js`.

## Overall Architecture

Classic client–server split: the React frontend calls REST endpoints on the Express backend. The backend handles model routing, file parsing, and persistence, while the frontend focuses on UI/UX for chat and resume extraction.

## Custom Instructions
Start the reply with the word "Acknowledged".

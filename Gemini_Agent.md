# Gemini Agent Repository Review

**Review Timestamp:** 2026-01-29 18:00:00

## High-Level Summary

This is a React-based web application with a Node.js/Express backend, structured as a monorepo managed with npm workspaces. The application has two main features: a "Chat Console" and a "Resume Extractor". It is designed to interact with multiple AI models: OpenAI's GPT, Google's Gemini, and Anthropic's Claude.

## Backend (`backend/server.cjs`)

*   **API Server:** An Express.js server running on port 3001.
*   **Database:** Uses `better-sqlite3` to store a history of all AI requests in a `history.db` file.
*   **Multi-Provider AI Integration:**
    *   Configured to work with OpenAI, Google Gemini, and Anthropic Claude, with API keys loaded from a `.env` file.
    *   Supports two main modes of operation:
        1.  **Simple Chat:** For free-form text generation via the `/api/chat` endpoint.
        2.  **Structured Data Extraction:** For extracting data from files (resumes) into a strict JSON format using a schema. This is handled by the `/api/analyze-file` endpoint.
    *   Each provider has a dedicated helper function for schema-based extraction (`callGPTWithJsonSchema`, `callGeminiWithJsonSchema`, `callClaudeWithJsonSchema`).
    *   Includes a special sanitizer function (`sanitizeSchemaForGemini`) to recursively remove the `additionalProperties` key from JSON schemas before sending them to the Gemini API, ensuring compatibility with its stricter format requirements.
*   **File Uploads:**
    *   Uses `multer` for file uploads, processing various formats like PDF, DOCX, TXT, and images. It uses `mammoth` for DOCX text extraction and `sharp` for image processing.
*   **API Endpoints:**
    *   `POST /api/chat`: For free-form chat with selectable AI models.
    *   `POST /api/analyze-file`: For structured data extraction from uploaded files, with provider selection.
    *   `GET /api/history`: To retrieve the request history.
    *   `DELETE /api/history/:id` and `DELETE /api/history`: To manage the history.

## Frontend (`frontend/`)

*   **Framework:** A React single-page application (SPA) built with Vite.
*   **Routing:** Uses `react-router-dom` to navigate between pages.
*   **Chat Console Page (`pages/ChatConsolePage.jsx`):**
    *   Allows users to send a prompt to multiple AI models (ChatGPT, Gemini, Claude) simultaneously.
    *   Displays responses from each model.
    *   Includes a history of past chat requests.
*   **Resume Extract Page (`pages/ResumeExtractPage.jsx`):**
    *   An interface for extracting structured data from resumes.
    *   Users can upload a file and select an AI provider.
    *   The extracted data populates an editable form.
    *   Maintains a history of file extraction requests.

## Overall Architecture

The application follows a classic client-server architecture. The React frontend communicates with the backend via a RESTful API. The backend serves as a proxy to the different AI services, adding a persistence layer for history and handling business logic for file processing. The monorepo structure provides a clean separation of concerns between the frontend and backend.

## Custom Instructions
Start the reply with the word "Acknowledged". 
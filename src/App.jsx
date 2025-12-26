import { useEffect, useMemo, useState } from "react";
import "./App.css";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Convert JSON to vertical rows: { path, value }
 * - Objects become dot paths (a.b.c)
 * - Arrays become bracket paths (arr[0].x)
 * - Primitive values become strings
 */
function jsonToRows(data) {
  const rows = [];

  function walk(value, path) {
    // null / primitive
    if (value === null || typeof value !== "object") {
      rows.push({ path: path || "(root)", value: value === undefined ? "" : String(value) });
      return;
    }

    // Array
    if (Array.isArray(value)) {
      if (value.length === 0) {
        rows.push({ path: path || "(root)", value: "[]" });
        return;
      }
      value.forEach((item, idx) => {
        const nextPath = path ? `${path}[${idx}]` : `[${idx}]`;
        walk(item, nextPath);
      });
      return;
    }

    // Object
    const keys = Object.keys(value);
    if (keys.length === 0) {
      rows.push({ path: path || "(root)", value: "{}" });
      return;
    }

    keys.forEach((k) => {
      const nextPath = path ? `${path}.${k}` : k;
      walk(value[k], nextPath);
    });
  }

  walk(data, "");
  return rows;
}

function downloadJsonToDisk(obj, filenameBase = "extracted") {
  const safeBase = (filenameBase || "extracted")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .slice(0, 80);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${safeBase}-${ts}.json`;

  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function App() {
  // Chat
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");

  // File analysis
  const [selectedFile, setSelectedFile] = useState(null);
  const [commandFile, setCommandFile] = useState("extract-v1.json");
  const [jsonResult, setJsonResult] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Persisted request history (from DB)
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => history.find((h) => Number(h.id) === Number(selectedId)) || null,
    [history, selectedId]
  );

  const currentJsonRows = useMemo(() => {
    if (!jsonResult || typeof jsonResult !== "object") return [];
    return jsonToRows(jsonResult);
  }, [jsonResult]);

  // Load history from DB on first page load
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/history?limit=200");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Failed to load history.");
        setHistory(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setError(e?.message || "Failed to load history.");
      }
    })();
  }, []);

  async function handleSend() {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setOutput("");
    setJsonResult(null);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data?.historyItem) {
          setHistory((prev) => [data.historyItem, ...prev]);
          setSelectedId(data.historyItem.id);
        }
        throw new Error(data?.error || "Request failed.");
      }

      setOutput(data.output || "");

      if (data?.historyItem) {
        setHistory((prev) => [data.historyItem, ...prev]);
        setSelectedId(data.historyItem.id);
      }
    } catch (e) {
      setError(e?.message || "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeFile() {
    if (!selectedFile || loading) return;

    setLoading(true);
    setError("");
    setOutput("");
    setJsonResult(null);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);

      const cmd = (commandFile || "").trim();
      if (cmd) fd.append("command", cmd);

      const resp = await fetch("/api/analyze-file", {
        method: "POST",
        body: fd,
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data?.historyItem) {
          setHistory((prev) => [data.historyItem, ...prev]);
          setSelectedId(data.historyItem.id);
        }
        throw new Error(data?.error || "File analysis failed.");
      }

      setJsonResult(data.result ?? null);

      if (data?.historyItem) {
        setHistory((prev) => [data.historyItem, ...prev]);
        setSelectedId(data.historyItem.id);
      }
    } catch (e) {
      setError(e?.message || "File analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function loadHistoryItem(item) {
    setSelectedId(item.id);
    setError(item.error || "");

    const reqType = item.request_type || "chat";

    if (reqType === "file" || item.result_json) {
      // For file items: show extracted JSON
      setPrompt("");
      setOutput("");

      if (item.result_json) {
        try {
          setJsonResult(JSON.parse(item.result_json));
        } catch {
          setJsonResult({ _raw: item.result_json });
        }
      } else {
        setJsonResult(null);
      }
    } else {
      // For chat items: show text output
      setPrompt(item.prompt || "");
      setOutput(item.response || "");
      setJsonResult(null);
    }
  }

  async function deleteHistoryItem(id) {
    try {
      const resp = await fetch(`/api/history/${id}`, { method: "DELETE" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Delete failed.");

      setHistory((prev) => prev.filter((h) => Number(h.id) !== Number(id)));

      if (Number(selectedId) === Number(id)) {
        setSelectedId(null);
        setPrompt("");
        setOutput("");
        setJsonResult(null);
        setError("");
      }
    } catch (e) {
      setError(e?.message || "Delete failed.");
    }
  }

  async function clearHistory() {
    try {
      const resp = await fetch("/api/history", { method: "DELETE" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Clear failed.");

      setHistory([]);
      setSelectedId(null);
      setPrompt("");
      setOutput("");
      setJsonResult(null);
      setError("");
    } catch (e) {
      setError(e?.message || "Clear failed.");
    }
  }

  function renderHistoryTitle(item) {
    const reqType = item.request_type || "chat";
    if (reqType === "file") {
      const name = item.file_name || "(file)";
      return `FILE: ${name}`;
    }
    return item.prompt || "(chat)";
  }

  // Determines filename base for downloading current JSON
  const downloadBaseName = useMemo(() => {
    if (selected && (selected.request_type === "file" || selected.result_json)) {
      const name = selected.file_name || "extracted";
      // Strip extension for nicer filename
      return name.replace(/\.[^/.]+$/, "") || "extracted";
    }
    if (selectedFile?.name) return selectedFile.name.replace(/\.[^/.]+$/, "");
    return "extracted";
  }, [selected, selectedFile]);

  return (
    <div style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Chat Console</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left side: actions + results */}
        <div style={{ flex: 2, minWidth: 560 }}>
          {/* Chat prompt */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type a prompt..."
              style={{ flex: 1, padding: 8 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button onClick={handleSend} disabled={loading || !prompt.trim()}>
              {loading ? "Sending..." : "Send"}
            </button>
          </div>

          {/* File analysis */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <h3 style={{ marginTop: 0 }}>Analyze a file</h3>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".pdf,.docx,.txt,image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />

              <input
                value={commandFile}
                onChange={(e) => setCommandFile(e.target.value)}
                placeholder="Command spec (e.g. extract-v1.json)"
                style={{ flex: 1, minWidth: 260, padding: 8 }}
              />

              <button onClick={handleAnalyzeFile} disabled={loading || !selectedFile}>
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {/* Selected file info */}
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {selectedFile ? (
                <div>
                  <div>
                    <strong>Selected:</strong> {selectedFile.name}
                  </div>
                  <div>
                    <strong>Size:</strong> {formatBytes(selectedFile.size)}{" "}
                    <span style={{ opacity: 0.75 }}>({selectedFile.size} bytes)</span>
                  </div>
                  <div>
                    <strong>Type:</strong> {selectedFile.type || "—"}
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No file selected.</div>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Supported: PDF, DOCX, TXT, JPG/PNG/WEBP/AVIF. Default command: extract-v1.json
            </div>
          </div>

          {/* Errors */}
          {error && <p style={{ marginTop: 12 }}>{error}</p>}

          {/* Text result */}
          <h3 style={{ marginTop: 16 }}>Text Result</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 12,
              border: "1px solid #ddd",
              minHeight: 140,
            }}
          >
            {output || (loading ? "Waiting..." : "—")}
          </pre>

          {/* Extracted JSON: raw + table + download */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <h3 style={{ margin: 0 }}>Extracted JSON</h3>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (!jsonResult) return;
                  downloadJsonToDisk(jsonResult, downloadBaseName);
                }}
                disabled={!jsonResult}
                title={jsonResult ? "Download current JSON" : "No JSON to download"}
              >
                Download JSON
              </button>

              <button onClick={() => setJsonResult(null)} disabled={!jsonResult}>
                Clear JSON View
              </button>
            </div>
          </div>

          {/* Raw JSON */}
          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 12,
              border: "1px solid #ddd",
              minHeight: 140,
              marginTop: 8,
            }}
          >
            {jsonResult ? JSON.stringify(jsonResult, null, 2) : "—"}
          </pre>

          {/* Vertical table view */}
          <h3 style={{ marginTop: 16 }}>Extracted Data Table</h3>
          <div style={{ border: "1px solid #ddd", maxHeight: 360, overflow: "auto" }}>
            {jsonResult ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee", width: "45%" }}>
                      Field
                    </th>
                    <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentJsonRows.map((r, idx) => (
                    <tr key={`${r.path}-${idx}`}>
                      <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        <code>{r.path}</code>
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        {r.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 12, opacity: 0.75 }}>—</div>
            )}
          </div>
        </div>

        {/* Right side: history */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Request History</h3>
            <button onClick={clearHistory} disabled={history.length === 0}>
              Clear All
            </button>
          </div>

          <div style={{ border: "1px solid #ddd" }}>
            {history.length === 0 ? (
              <div style={{ padding: 12 }}>No requests yet.</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: Number(item.id) === Number(selectedId) ? "#f6f6f6" : "white",
                  }}
                >
                  <button
                    onClick={() => loadHistoryItem(item)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {item.created_at}
                      {typeof item.duration_ms === "number" ? ` • ${item.duration_ms}ms` : ""}
                      {" • "}
                      {item.status}
                      {" • "}
                      {(item.request_type || "chat").toUpperCase()}
                      {item.command_name ? ` • ${item.command_name}` : ""}
                    </div>

                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      {(() => {
                        const title = renderHistoryTitle(item);
                        return title.length > 70 ? title.slice(0, 70) + "…" : title;
                      })()}
                    </div>

                    {(item.request_type === "file" || item.file_name) && (
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                        {item.file_name ? `File: ${item.file_name}` : ""}
                        {Number.isFinite(item.file_size) ? ` • ${formatBytes(item.file_size)}` : ""}
                        {item.file_mime ? ` • ${item.file_mime}` : ""}
                      </div>
                    )}
                  </button>

                  <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                    <button onClick={() => deleteHistoryItem(item.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected preview */}
          {selected ? (
            <>
              <h4 style={{ marginTop: 12 }}>Selected Item Preview</h4>

              {selected.request_type === "file" || selected.result_json ? (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    padding: 12,
                    border: "1px solid #ddd",
                    maxHeight: 260,
                    overflow: "auto",
                  }}
                >
                  {(() => {
                    if (!selected.result_json) return "—";
                    try {
                      return JSON.stringify(JSON.parse(selected.result_json), null, 2);
                    } catch {
                      return selected.result_json;
                    }
                  })()}
                </pre>
              ) : (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    padding: 12,
                    border: "1px solid #ddd",
                    maxHeight: 260,
                    overflow: "auto",
                  }}
                >
                  {selected.response || "—"}
                </pre>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

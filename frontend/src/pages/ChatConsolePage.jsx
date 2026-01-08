import { useEffect, useMemo, useState } from "react";

// File-analysis helpers removed: formatBytes, jsonToRows, downloadJsonToDisk
// JSON/table download and file-size formatting are not used on the Chat Console page anymore.


function isChatHistoryItem(item) {
  const t = item?.request_type || "chat";
  return t !== "file";
}

export default function ChatConsolePage() {
  // Chat
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Persisted request history (from DB) - CHAT ONLY on this page
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => history.find((h) => Number(h.id) === Number(selectedId)) || null,
    [history, selectedId]
  );


  // Load history from DB on first page load (CHAT ONLY)
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/history?limit=200");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Failed to load history.");

        const items = Array.isArray(data.items) ? data.items : [];
        setHistory(items.filter(isChatHistoryItem));
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
    //setJsonResult(null);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        // Only track chat items in this panel
        if (data?.historyItem && isChatHistoryItem(data.historyItem)) {
          setHistory((prev) => [data.historyItem, ...prev]);
          setSelectedId(data.historyItem.id);
        }
        throw new Error(data?.error || "Request failed.");
      }

      setOutput(data.output || "");

      // Only track chat items in this panel
      if (data?.historyItem && isChatHistoryItem(data.historyItem)) {
        setHistory((prev) => [data.historyItem, ...prev]);
        setSelectedId(data.historyItem.id);
      }
    } catch (e) {
      setError(e?.message || "Unknown error.");
    } finally {
      setLoading(false);
    }
  }



  function loadHistoryItem(item) {
    setSelectedId(item.id);
    setError(item.error || "");

    // This panel shows only chat items; load prompt/response if present.
    setPrompt(item.prompt || "");
    setOutput(item.response || "");
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
        //setJsonResult(null);
        setError("");
      }
    } catch (e) {
      setError(e?.message || "Delete failed.");
    }
  }

  // Clear only the items shown in THIS panel (CHAT-only),
  // without calling the global DELETE /api/history which would wipe FILE history too.
  async function clearHistoryPanel() {
    if (history.length === 0) return;

    setLoading(true);
    setError("");
    try {
      for (const item of history) {
        const resp = await fetch(`/api/history/${item.id}`, { method: "DELETE" });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data?.error || `Failed clearing id=${item.id}`);
        }
      }

      setHistory([]);
      setSelectedId(null);
      setPrompt("");
      setOutput("");
      //setJsonResult(null);
      setError("");
    } catch (e) {
      setError(e?.message || "Clear failed.");
    } finally {
      setLoading(false);
    }
  }

  function renderHistoryTitle(item) {
    return item.prompt || "(chat)";
  }


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

          {/* Selected Request History Preview. 
          <h4 style={{ marginTop: 12 }}>Selected Request History Preview. </h4>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 12,
              border: "1px solid #ddd",
              maxHeight: 260,
              overflow: "auto",
            }}
          >
            {selected ? selected.response || "—" : "—"}
          </pre>
          */}

        </div>

        {/* Right side: CHAT history */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Request History (Chat)</h3>
            <button onClick={clearHistoryPanel} disabled={loading || history.length === 0}>
              Clear All (Chat)
            </button>
          </div>

          <div style={{ border: "1px solid #ddd" }}>
            {history.length === 0 ? (
              <div style={{ padding: 12 }}>No chat requests yet.</div>
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
                  </button>

                  <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                    <button onClick={() => deleteHistoryItem(item.id)} disabled={loading}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>


        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react'
import './App.css'

export default function App() {
  //const [count, setCount] = useState(0)

  // Get timestamp
  function nowIso(){
    return new Date().toISOString();
  }

  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Request history (current session: in-memory)
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => history.find((h) => Number(h.id) === Number(selectedId)) || null,
    [history, selectedId]
  );

  // Load history from DB on first page load
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/history?limit=200");
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Failed to load history.");
        setHistory(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setError(e.message || "Failed to load history.");
      }
    })();
  }, []);

  async function handleSend() {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setOutput("");

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        // even on error, we may receive historyItem (per server.cjs above)
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
      setError(e.message || "Unknown error.");
    } finally {
      setLoading(false);
    }
  }// end of handleSend() function

  function loadHistoryItem(item) {
    setSelectedId(item.id);
    setPrompt(item.prompt || "");
    setOutput(item.response || "");
    setError(item.error || "");
  }

  async function deleteHistoryItem(id) {
    try {
      const resp = await fetch(`/api/history/${id}`, { method: "DELETE" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Delete failed.");

      setHistory((prev) => prev.filter((h) => Number(h.id) !== Number(id)));
      if (Number(selectedId) === Number(id)) {
        setSelectedId(null);
        setOutput("");
        setError("");
      }
    } catch (e) {
      setError(e.message || "Delete failed.");
    }
  }
  

  async function clearHistory() {
    try {
      const resp = await fetch("/api/history", { method: "DELETE" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Clear failed.");

      setHistory([]);
      setSelectedId(null);
      setOutput("");
      setError("");
    } catch (e) {
      setError(e.message || "Clear failed.");
    }
  }


  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Chat Console</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 2, minWidth: 500 }}>
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

          {error && <p style={{ marginTop: 12 }}>{error}</p>}

          <h3 style={{ marginTop: 16 }}>Result</h3>
          <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #ddd", minHeight: 160 }}>
            {output || (loading ? "Waiting..." : "—")}
          </pre>
        </div>

        <div style={{ flex: 1, minWidth: 360 }}>
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
                    </div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      {item.prompt?.length > 60 ? item.prompt.slice(0, 60) + "…" : item.prompt}
                    </div>
                  </button>

                  <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                    <button onClick={() => deleteHistoryItem(item.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selected && selected.response ? (
            <>
              <h4 style={{ marginTop: 12 }}>Selected Response (preview)</h4>
              <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #ddd", maxHeight: 240, overflow: "auto" }}>
                {selected.response}
              </pre>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

//export default App

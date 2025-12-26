import { useMemo, useState } from 'react'
import './App.css'

function App() {
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
    () => history.find((h) => h.id === selectedId) || null,
    [history, selectedId]
  );

  async function handleSend(){// this will handle the sent to GPT
    
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    
    setLoading(true);
    setError("");
    setOutput("");

    const id = crypto?.randomUUID?.() || String(Date.now());
    const startedAt = performance.now();
    const createdAt = nowIso();

    // Optimistically add a pending item
    setHistory((prev) => [
      {
        id,
        createdAt,
        prompt: trimmed,
        response: "",
        status: "pending", // "pending" | "success" | "error"
        durationMs: null,
      },
      ...prev,
    ]);
    setSelectedId(id);

    try{
      const resp = await fetch("/api/chat", {
        method: "POST", 
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt: trimmed}),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed.");

      const text = data.output || "";
      setOutput(text);

      const durationMs = Math.round(performance.now() - startedAt);

      setHistory((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                response: text,
                status: "success",
                durationMs,
              }
            : item
        )
      );

    } catch (e) {
      const msg = e?.message || "Unknown error.";
      setError(msg);

      const durationMs = Math.round(performance.now() - startedAt);

      setHistory((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                response: "",
                status: "error",
                error: msg,
                durationMs,
              }
            : item
        )
      );
    } finally {
      setLoading(false);
    }
  }// end of handleSend() function

  function loadHistoryItem(item) {
    setSelectedId(item.id);
    setPrompt(item.prompt);
    setOutput(item.response || "");
    setError(item.error || "");
  }

  function clearHistory() {
    setHistory([]);
    setSelectedId(null);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Chat Console</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: main input/output */}
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
          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 12,
              border: "1px solid #ddd",
              minHeight: 160,
            }}
          >
            {output || (loading ? "Waiting..." : "—")}
          </pre>
        </div>

        {/* Right: history */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ marginTop: 0 }}>Request History</h3>
            <button onClick={clearHistory} disabled={history.length === 0}>
              Clear
            </button>
          </div>

          <div style={{ border: "1px solid #ddd" }}>
            {history.length === 0 ? (
              <div style={{ padding: 12 }}>No requests yet.</div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: 12,
                    border: "none",
                    borderBottom: "1px solid #eee",
                    background: item.id === selectedId ? "#f6f6f6" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {item.createdAt}
                    {typeof item.durationMs === "number"
                      ? ` • ${item.durationMs}ms`
                      : ""}
                    {" • "}
                    {item.status}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>
                    {item.prompt.length > 60
                      ? item.prompt.slice(0, 60) + "…"
                      : item.prompt}
                  </div>
                </button>
              ))
            )}
          </div>

          {selected && selected.response ? (
            <>
              <h4 style={{ marginTop: 12 }}>Selected Response (preview)</h4>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  padding: 12,
                  border: "1px solid #ddd",
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {selected.response}
              </pre>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default App

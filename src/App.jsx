import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  //const [count, setCount] = useState(0)

  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(){// this will handle the sent to GPT
    setLoading(true);
    setError("");
    setOutput("");

    try{
      const resp = await fetch("/api/chat", {
        method: "POST", 
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt}),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed.");

      setOutput(data.output || "");
    } catch (e) {
      setError(e.message || "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  

  return (
    <>
      <div style={{ padding: 24, maxWidth: 800 }}>
        <h1>ChatGPT Command Console</h1>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your command..."
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

        <div style={{ marginTop: 16 }}>
          <h3>Result</h3>
          <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #ddd" }}>
            {output || (loading ? "Waiting for response..." : "—")}
          </pre>
        </div>
      </div>
    </>
  )
}

export default App

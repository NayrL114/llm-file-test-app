import { useEffect, useMemo, useState } from "react";

const RESUME_SCHEMA_KEY = "resumeSchemaCommand";
const DEFAULT_RESUME_SCHEMA = "resume-extract-v3.json";
// v0 maps to the legacy extract-v1.json schema file.
const RESUME_SCHEMA_OPTIONS = [
  { value: "resume-extract-v3.json", label: "Resume Extract Schema v3" },
  { value: "resume-extract-v2.json", label: "Resume Extract Schema v2" },
  { value: "resume-extract-v1.json", label: "Resume Extract Schema v1" },
  { value: "extract-v1.json", label: "Resume Extract Schema v0" },
];

function normalizeSchemaCommand(value) {
  const option = RESUME_SCHEMA_OPTIONS.find((o) => o.value === value);
  return option ? option.value : DEFAULT_RESUME_SCHEMA;
}

export default function SettingsPage() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || "", []);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [resumeSchema, setResumeSchema] = useState(() =>
    normalizeSchemaCommand(localStorage.getItem(RESUME_SCHEMA_KEY))
  );
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });
  const [warning, setWarning] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  function handleSchemaChange(e) {
    // Persist the chosen schema for the Resume Extract page.
    const next = normalizeSchemaCommand(e.target.value);
    setResumeSchema(next);
    localStorage.setItem(RESUME_SCHEMA_KEY, next);
  }

  async function handleSave() {
    const openai = openaiKey.trim();
    const anthropic = anthropicKey.trim();
    const google = googleKey.trim();

    setWarning("");
    setStatus("");
    setError("");

    if (!openai && !anthropic && !google) {
      setWarning("Please provide API key input");
      return;
    }

    const payload = {};
    if (openai) payload.openaiKey = openai;
    if (anthropic) payload.anthropicKey = anthropic;
    if (google) payload.googleKey = google;

    setSaving(true);
    try {
      const resp = await fetch(`${apiBase}/api/settings/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Failed to save API keys.");

      setOpenaiKey("");
      setAnthropicKey("");
      setGoogleKey("");
      setStatus("Restart-backend");
    } catch (e) {
      setError(e?.message || "Failed to save API keys.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Settings</h1>

      <section
        style={{
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          background: "var(--panel-bg)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>API Keys</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label>OpenAI API Key</label>
            <input
              type="text"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              style={{ width: "100%", padding: 10 }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          
          <div>
            <label>Gemini API Key</label>
            <input
              type="text"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="AIza..."
              style={{ width: "100%", padding: 10 }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div>
            <label>Claude API Key</label>
            <input
              type="text"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ width: "100%", padding: 10 }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          
        </div>

        

        <div style={{ marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {warning && <div style={{ marginTop: 12, color: "var(--warning)" }}>{warning}</div>}
        {error && <div style={{ marginTop: 12, color: "var(--danger)" }}>{error}</div>}
        {status && <div style={{ marginTop: 12, color: "var(--accent)" }}>{status}</div>}
      </section>

      <section
        style={{
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          background: "var(--panel-bg)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Resume Extraction</h2>
        <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <label>Schema Version</label>
          <select
            value={resumeSchema}
            onChange={handleSchemaChange}
            style={{ width: "100%", padding: 10 }}
          >
            {RESUME_SCHEMA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Applies to new resume extractions only.
          </div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid var(--panel-border)",
          borderRadius: 8,
          padding: 16,
          background: "var(--panel-bg)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Appearance</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={theme === "dark"}
            onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
          />
          Night mode
        </label>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Utility: Deep clone a JSON-serializable object.
 */
function cloneDeep(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

/**
 * Utility: Convert array of strings to a newline-separated string.
 */
function toLines(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join("\n");
}

/**
 * Utility: Convert newline-separated string back into an array of trimmed strings.
 */
function fromLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Utility: Format bytes into human-readable sizes.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * Returns a blank resume structure matching the defined schema.
 */
function emptyResume() {
  return {
    personal_profile: {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      phone_country_code: "",
      phone: "",
      email: "",
      location: "",
      website_links: [],
      skill_keywords: [],
      bio: "",
    },
    education_history: [],
    work_history: [],
    optional_sections: [],
  };
}

/**
 * Ensures a resume object matches the expected structure, providing defaults for missing fields.
 */
function normalizeResume(resume) {
  const r = resume || {};
  const pp = r.personal_profile || {};

  return {
    personal_profile: {
      first_name: pp.first_name ?? "",
      last_name: pp.last_name ?? "",
      date_of_birth: pp.date_of_birth ?? "",
      phone_country_code: pp.phone_country_code ?? "",
      phone: pp.phone ?? "",
      email: pp.email ?? "",
      location: pp.location ?? "",
      website_links: Array.isArray(pp.website_links) ? pp.website_links : [],
      skill_keywords: Array.isArray(pp.skill_keywords) ? pp.skill_keywords : [],
      bio: pp.bio ?? "",
    },
    education_history: Array.isArray(r.education_history) ? r.education_history : [],
    work_history: Array.isArray(r.work_history) ? r.work_history : [],
    optional_sections: Array.isArray(r.optional_sections) ? r.optional_sections : [],
  };
}

function emptyEducation() {
  return {
    degree_name: "",
    school_name: "",
    start_time: "",
    end_time: "",
    descriptions: [],
  };
}

function emptyWork() {
  return {
    role_name: "",
    company_name: "",
    start_time: "",
    end_time: "",
    descriptions: [],
  };
}

function emptyOptionalSection() {
  return {
    section_name: "",
    content: "",
  };
}

function isFileHistoryItem(item) {
  const t = item?.request_type || "";
  return t === "file";
}

/**
 * Parses the raw JSON response from the LLM into a list of resume objects.
 */
function parseResultJsonToResumes(resultJsonText) {
  if (!resultJsonText) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(resultJsonText);
  } catch {
    return [];
  }

  // Schema expects { resumes: [...] }
  if (Array.isArray(parsed?.resumes)) return parsed.resumes;
  // Fallback for single object responses
  if (parsed && typeof parsed === "object" && parsed.personal_profile) return [parsed];

  return [];
}

export default function ResumeExtractPage() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || "", []);
  const fileInputRef = useRef(null);

  // Editable form state
  const [draftResumes, setDraftResumes] = useState([emptyResume()]);
  const [selectedResumeIndex, setSelectedResumeIndex] = useState(0);

  // Extraction settings
  const [file, setFile] = useState(null);
  const [overwriteOnAnalyze, setOverwriteOnAnalyze] = useState(true);
  
  // NEW: State for the AI model provider (Default: ChatGPT/OpenAI)
  const [provider, setProvider] = useState("openai");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Raw preview of the current or last extraction
  const [extractedResult, setExtractedResult] = useState(null);

  // Request history
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const selectedHistoryItem = useMemo(
    () => history.find((h) => Number(h.id) === Number(selectedHistoryId)) || null,
    [history, selectedHistoryId]
  );

  const currentDraftResume = useMemo(() => {
    return draftResumes[selectedResumeIndex] || null;
  }, [draftResumes, selectedResumeIndex]);

  /**
   * Updates a specific field in the current draft resume.
   */
  function setResumeAtIndex(idx, updater) {
    setDraftResumes((prev) => {
      const next = prev.map((r) => cloneDeep(r));
      const cur = next[idx];
      if (!cur) return prev;
      next[idx] = updater(cur);
      return next;
    });
  }

  /**
   * Resets the entire page to a blank state.
   */
  function resetToEmptyForm() {
    setErrorMsg("");
    setExtractedResult(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDraftResumes([emptyResume()]);
    setSelectedResumeIndex(0);
    setSelectedHistoryId(null);
    setProvider("openai"); // Reset provider to default
  }

  // Load request history on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${apiBase}/api/history?limit=200`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Failed to load history.");

        const items = Array.isArray(data.items) ? data.items : [];
        setHistory(items.filter(isFileHistoryItem));
      } catch (e) {
        setErrorMsg(e?.message || "Failed to load history.");
      }
    })();
  }, [apiBase]);

  /**
   * Populates the form using data from a previous extraction stored in history.
   */
  function loadHistoryItemToForm(item) {
    setSelectedHistoryId(item.id);
    setErrorMsg(item.error || "");

    const resumes = parseResultJsonToResumes(item.result_json);
    const normalized = resumes.map((r) => normalizeResume(r));

    if (!normalized.length) {
      setErrorMsg("This history item contains no usable resume data.");
      return;
    }

    setDraftResumes(normalized);
    setSelectedResumeIndex(0);

    try {
      setExtractedResult(JSON.parse(item.result_json));
    } catch {
      setExtractedResult(null);
    }

    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /**
   * Deletes a single history entry.
   */
  async function deleteHistoryItem(id) {
    try {
      const resp = await fetch(`${apiBase}/api/history/${id}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Delete failed.");

      setHistory((prev) => prev.filter((h) => Number(h.id) !== Number(id)));
      if (Number(selectedHistoryId) === Number(id)) setSelectedHistoryId(null);
    } catch (e) {
      setErrorMsg(e?.message || "Delete failed.");
    }
  }

  /**
   * Clears the file extraction history panel.
   */
  async function clearHistoryPanel() {
    if (history.length === 0) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      for (const item of history) {
        const resp = await fetch(`${apiBase}/api/history/${item.id}`, { method: "DELETE" });
        if (!resp.ok) throw new Error(`Failed clearing id=${item.id}`);
      }
      setHistory([]);
      setSelectedHistoryId(null);
    } catch (e) {
      setErrorMsg(e?.message || "Clear failed.");
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Sends the file to the backend for analysis using the selected AI provider.
   */
  async function handleAnalyze() {
    setErrorMsg("");
    setExtractedResult(null);

    if (!file) {
      setErrorMsg("No file selected. Please choose a file to import.");
      return;
    }

    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // This matches the file name in your backend/commands folder
      fd.append("command", "resume-extract-v1.json");
      
      // Sends "openai", "gemini", or "claude" based on radio selection
      fd.append("provider", provider);

      const res = await fetch(`${apiBase}/api/analyze-file`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If the server returned a history item even on failure (error logging)
        if (data?.historyItem) {
          setHistory((prev) => [data.historyItem, ...prev]);
          setSelectedHistoryId(data.historyItem.id);
        }
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      // 1. Update the raw preview state
      const result = data?.result ?? null;
      setExtractedResult(result);

      // 2. Add the new successful extraction to the History sidebar
      if (data?.historyItem) {
        setHistory((prev) => [data.historyItem, ...prev]);
        setSelectedHistoryId(data.historyItem.id);
      }

      // 3. Process the extracted resume data for the form
      // The JSON schema in resume-extract-v1.json returns { "resumes": [...] }
      const resumes = Array.isArray(result?.resumes) ? result.resumes : [];
      const normalized = resumes.map((r) => normalizeResume(r));

      if (normalized.length === 0) {
        throw new Error("The AI returned successfully, but no resume data was found in the output.");
      }

      // 4. Update the form draft state
      let nextSelectedIndex = 0;
      setDraftResumes((prev) => {
        if (overwriteOnAnalyze) {
          nextSelectedIndex = 0;
          return normalized;
        }
        // If not overwriting, append new resumes to the end of the existing list
        nextSelectedIndex = prev.length;
        return [...prev.map((r) => cloneDeep(r)), ...normalized];
      });
      
      setSelectedResumeIndex(nextSelectedIndex);

    } catch (err) {
      console.error("Analysis Error:", err);
      setErrorMsg(err?.message || "Failed to analyze the resume.");
    } finally {
      setIsLoading(false);
    }
  }

  function renderHistoryTitle(item) {
    const name = item.file_name || "(file)";
    return `FILE: ${name}`;
  }

  if (!currentDraftResume) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Resume Extract</h1>
        <p>Form state error. Please click Reset.</p>
        <button onClick={resetToEmptyForm}>Reset Form</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Resume Extract</h1>
      <p style={{ marginTop: 0 }}>
        Manually fill the form or import data using an AI model.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        
        {/* Left Panel: File Import & Main Form */}
        <div style={{ flex: 2, minWidth: 560 }}>
          
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Import from Resume (Optional)</h2>

            {/* Model Selection Radio Buttons */}
            <div style={{ marginBottom: 15, display: "flex", flexWrap: "wrap", gap: 16 }}>
              <span style={{ fontWeight: 600 }}>AI Model:</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={provider === "openai"}
                  onChange={(e) => setProvider(e.target.value)}
                />
                ChatGPT 5.2
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="provider"
                  value="gemini"
                  checked={provider === "gemini"}
                  onChange={(e) => setProvider(e.target.value)}
                />
                Gemini 2.5 Flash
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="provider"
                  value="claude"
                  checked={provider === "claude"}
                  onChange={(e) => setProvider(e.target.value)}
                />
                Claude Sonnet 4
              </label>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={handleAnalyze} disabled={isLoading} style={{ fontWeight: 600 }}>
                {isLoading ? "Analyzing..." : "Analyze & Import"}
              </button>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={overwriteOnAnalyze}
                  onChange={(e) => setOverwriteOnAnalyze(e.target.checked)}
                />
                Overwrite form on import
              </label>

              <button type="button" onClick={resetToEmptyForm} disabled={isLoading}>
                Reset Form
              </button>

              {draftResumes.length > 1 && (
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Resume Index:
                  <select
                    value={selectedResumeIndex}
                    onChange={(e) => setSelectedResumeIndex(Number(e.target.value))}
                  >
                    {draftResumes.map((_, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* File metadata */}
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {file ? (
                <div>
                  <div><strong>Selected:</strong> {file.name}</div>
                  <div><strong>Size:</strong> {formatBytes(file.size)}</div>
                  <div><strong>Type:</strong> {file.type || "unknown"}</div>
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No file selected.</div>
              )}
            </div>

            {errorMsg && (
              <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{errorMsg}</div>
            )}
          </section>

          {/* Application Form Sections */}
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Application Form</h2>

            {/* Personal Profile Section */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>Personal Profile</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>First Name</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.first_name}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.first_name = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Last Name</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.last_name}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.last_name = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Date of Birth</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.date_of_birth}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.date_of_birth = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Location</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.location}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.location = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Country Code</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.phone_country_code}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.phone_country_code = e.target.value; return r; })}
                  />
                </div>
                <div>
                  <label>Phone</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.phone}
                    onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.phone = e.target.value; return r; })}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Email</label>
                <input
                  style={{ width: "100%", padding: 8 }}
                  value={currentDraftResume.personal_profile.email}
                  onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.email = e.target.value; return r; })}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Skill Keywords (one per line)</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 80 }}
                  value={toLines(currentDraftResume.personal_profile.skill_keywords)}
                  onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.skill_keywords = fromLines(e.target.value); return r; })}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Bio</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 100 }}
                  value={currentDraftResume.personal_profile.bio}
                  onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.personal_profile.bio = e.target.value; return r; })}
                />
              </div>
            </div>

            {/* Education History Section */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Education History</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history = [...(r.education_history || []), emptyEducation()]; return r; })}>
                  Add Education
                </button>
              </div>
              {currentDraftResume.education_history.map((ed, idx) => (
                <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>Entry #{idx + 1}</strong>
                    <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history = r.education_history.filter((_, i) => i !== idx); return r; })}>Remove</button>
                  </div>
                  <input placeholder="School Name" style={{ width: "100%", padding: 8, marginTop: 8 }} value={ed.school_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].school_name = e.target.value; return r; })} />
                  <input placeholder="Degree" style={{ width: "100%", padding: 8, marginTop: 8 }} value={ed.degree_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].degree_name = e.target.value; return r; })} />
                </div>
              ))}
            </div>

            {/* Work History Section */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Work History</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_history = [...(r.work_history || []), emptyWork()]; return r; })}>
                  Add Work
                </button>
              </div>
              {currentDraftResume.work_history.map((wk, idx) => (
                <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>Entry #{idx + 1}</strong>
                    <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_history = r.work_history.filter((_, i) => i !== idx); return r; })}>Remove</button>
                  </div>
                  <input placeholder="Company Name" style={{ width: "100%", padding: 8, marginTop: 8 }} value={wk.company_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_history[idx].company_name = e.target.value; return r; })} />
                  <input placeholder="Role" style={{ width: "100%", padding: 8, marginTop: 8 }} value={wk.role_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_history[idx].role_name = e.target.value; return r; })} />
                </div>
              ))}
            </div>
          </section>

          {/* JSON Previews */}
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>JSON Preview</h2>
            <pre style={{ margin: 0, overflow: "auto", maxHeight: 400, background: "#f7f7f7", padding: 12 }}>
              {JSON.stringify({ resumes: draftResumes }, null, 2)}
            </pre>
            {extractedResult && (
              <div style={{ marginTop: 20 }}>
                <h3>Last Model Output (Raw)</h3>
                <pre style={{ margin: 0, overflow: "auto", maxHeight: 400, background: "#f1f1f1", padding: 12 }}>
                  {JSON.stringify(extractedResult, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>

        {/* Right Panel: Extraction History */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Request History (File)</h3>
            <button onClick={clearHistoryPanel} disabled={isLoading || history.length === 0}>
              Clear Panel
            </button>
          </div>

          <div style={{ border: "1px solid #ddd" }}>
            {history.length === 0 ? (
              <div style={{ padding: 12 }}>No history found.</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: Number(item.id) === Number(selectedHistoryId) ? "#f6f6f6" : "white",
                  }}
                >
                  <button
                    onClick={() => loadHistoryItemToForm(item)}
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
                      {item.created_at} • {item.status}
                    </div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{renderHistoryTitle(item)}</div>
                  </button>
                  <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                    <button onClick={() => deleteHistoryItem(item.id)} disabled={isLoading}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedHistoryItem && (
            <div style={{ marginTop: 15 }}>
              <h4>History Item Detail</h4>
              <pre style={{ whiteSpace: "pre-wrap", padding: 10, border: "1px solid #ddd", maxHeight: 300, overflow: "auto" }}>
                {JSON.stringify(JSON.parse(selectedHistoryItem.result_json || "{}"), null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
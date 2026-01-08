import { useEffect, useMemo, useRef, useState } from "react";

function cloneDeep(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function toLines(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join("\n");
}

function fromLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

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

function normalizeResume(resume) {
  // defensive normalization in case model/backend changes over time
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

function parseResultJsonToResumes(resultJsonText) {
  if (!resultJsonText) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(resultJsonText);
  } catch {
    return [];
  }

  // Typical shape: { resumes: [...] }
  if (Array.isArray(parsed?.resumes)) return parsed.resumes;

  // Fallback: sometimes might be a single resume object
  if (parsed && typeof parsed === "object" && parsed.personal_profile) return [parsed];

  return [];
}

export default function ResumeExtractPage() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || "", []);
  const fileInputRef = useRef(null);

  // Start with an empty, editable resume by default (job application style)
  const [draftResumes, setDraftResumes] = useState([emptyResume()]);
  const [selectedResumeIndex, setSelectedResumeIndex] = useState(0);

  // Upload/analyze (optional workflow)
  const [file, setFile] = useState(null);
  const [overwriteOnAnalyze, setOverwriteOnAnalyze] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // raw extracted result (for preview)
  const [extractedResult, setExtractedResult] = useState(null);

  // FILE request history (from DB) - FILE ONLY on this page
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const selectedHistoryItem = useMemo(
    () => history.find((h) => Number(h.id) === Number(selectedHistoryId)) || null,
    [history, selectedHistoryId]
  );

  const currentDraftResume = useMemo(() => {
    return draftResumes[selectedResumeIndex] || null;
  }, [draftResumes, selectedResumeIndex]);

  function setResumeAtIndex(idx, updater) {
    setDraftResumes((prev) => {
      const next = prev.map((r) => cloneDeep(r));
      const cur = next[idx];
      if (!cur) return prev;
      next[idx] = updater(cur);
      return next;
    });
  }

  function resetToEmptyForm() {
    setErrorMsg("");
    setExtractedResult(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setDraftResumes([emptyResume()]);
    setSelectedResumeIndex(0);

    setSelectedHistoryId(null);
  }

  // Load FILE history from DB on first page load (FILE ONLY)
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

  function loadHistoryItemToForm(item) {
    setSelectedHistoryId(item.id);
    setErrorMsg(item.error || "");

    // Parse DB JSON, then fill the editable form
    const resumes = parseResultJsonToResumes(item.result_json);
    const normalized = resumes.map((r) => normalizeResume(r));

    if (!normalized.length) {
      setErrorMsg(
        "This history item does not contain a usable resume payload in result_json. (Expected { resumes: [...] })."
      );
      return;
    }

    // Fill form with the stored extraction
    setDraftResumes(normalized);
    setSelectedResumeIndex(0);

    // Keep a copy for preview if you want (read-only)
    try {
      setExtractedResult(JSON.parse(item.result_json));
    } catch {
      setExtractedResult(null);
    }

    // Clear any currently selected upload file (history is the source now)
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteHistoryItem(id) {
    try {
      const resp = await fetch(`${apiBase}/api/history/${id}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Delete failed.");

      setHistory((prev) => prev.filter((h) => Number(h.id) !== Number(id)));

      if (Number(selectedHistoryId) === Number(id)) {
        setSelectedHistoryId(null);
      }
    } catch (e) {
      setErrorMsg(e?.message || "Delete failed.");
    }
  }

  // Clear only the items shown in THIS panel (FILE-only),
  // without calling the global DELETE /api/history which would wipe CHAT history too.
  async function clearHistoryPanel() {
    if (history.length === 0) return;

    setIsLoading(true);
    setErrorMsg("");
    try {
      for (const item of history) {
        const resp = await fetch(`${apiBase}/api/history/${item.id}`, { method: "DELETE" });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data?.error || `Failed clearing id=${item.id}`);
        }
      }

      setHistory([]);
      setSelectedHistoryId(null);
    } catch (e) {
      setErrorMsg(e?.message || "Clear failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAnalyze() {
    setErrorMsg("");
    setExtractedResult(null);

    if (!file) {
      setErrorMsg("No file selected. You can fill the form manually, or choose a file to import.");
      return;
    }

    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("command", "resume-extract-v1.json");

      const res = await fetch(`${apiBase}/api/analyze-file`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If backend returns historyItem on errors, include it in FILE history panel
        if (data?.historyItem && isFileHistoryItem(data.historyItem)) {
          setHistory((prev) => [data.historyItem, ...prev]);
          setSelectedHistoryId(data.historyItem.id);
        }
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      const result = data?.result ?? null;
      setExtractedResult(result);

      // Add successful history item to FILE panel
      if (data?.historyItem && isFileHistoryItem(data.historyItem)) {
        setHistory((prev) => [data.historyItem, ...prev]);
        setSelectedHistoryId(data.historyItem.id);
      }

      const resumes = Array.isArray(result?.resumes) ? result.resumes : [];
      const normalized = resumes.map((r) => normalizeResume(r));

      if (!normalized.length) {
        throw new Error("Extraction returned 0 resumes. Please check the file contents.");
      }

      let nextSelectedIndex = 0;
      setDraftResumes((prev) => {
        if (overwriteOnAnalyze) {
          nextSelectedIndex = 0;
          return normalized;
        }
        nextSelectedIndex = prev.length;
        return [...prev.map((r) => cloneDeep(r)), ...normalized];
      });
      setSelectedResumeIndex(nextSelectedIndex);
    } catch (err) {
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
    // Should not happen, but keep it safe
    return (
      <div>
        <h1>Resume Extract</h1>
        <p>Form state is missing. Click Reset Form.</p>
        <button type="button" onClick={resetToEmptyForm}>
          Reset Form
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1250 }}>
      <h1>Resume Extract</h1>
      <p style={{ marginTop: 0 }}>
        Fill in the application form manually, or import from a resume to pre-fill fields (schema:{" "}
        <code>resume_extraction_v1</code>). You can also load a previously extracted resume from Request History.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: Import + Form + JSON Preview */}
        <div style={{ flex: 2, minWidth: 560 }}>
          {/* Import (optional) */}
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Import from Resume (Optional)</h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={handleAnalyze} disabled={isLoading}>
                {isLoading ? "Analyzing..." : "Analyze & Import"}
              </button>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={overwriteOnAnalyze}
                  onChange={(e) => setOverwriteOnAnalyze(e.target.checked)}
                />
                Overwrite current form on import
              </label>

              <button type="button" onClick={resetToEmptyForm} disabled={isLoading}>
                Reset Form
              </button>

              {draftResumes.length > 1 && (
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Resume:
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

            {/* Selected file info */}
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {file ? (
                <div>
                  <div>
                    <strong>Selected:</strong> {file.name}
                  </div>
                  <div>
                    <strong>Size:</strong> {formatBytes(file.size)}{" "}
                    <span style={{ opacity: 0.75 }}>({file.size} bytes)</span>
                  </div>
                  <div>
                    <strong>Type:</strong> {file.type || "—"}
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No file selected.</div>
              )}
            </div>

            {errorMsg && (
              <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{errorMsg}</div>
            )}
          </section>

          {/* Form */}
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Application Form</h2>

            {/* Personal Profile */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <h3 style={{ marginTop: 0 }}>Personal Profile</h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>First Name</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.first_name}
                    onChange={(e) =>
                      setResumeAtIndex(selectedResumeIndex, (r) => {
                        r.personal_profile.first_name = e.target.value;
                        return r;
                      })
                    }
                  />
                </div>

                <div>
                  <label>Last Name</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.last_name}
                    onChange={(e) =>
                      setResumeAtIndex(selectedResumeIndex, (r) => {
                        r.personal_profile.last_name = e.target.value;
                        return r;
                      })
                    }
                  />
                </div>

                <div>
                  <label>Date of Birth</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.date_of_birth}
                    onChange={(e) =>
                      setResumeAtIndex(selectedResumeIndex, (r) => {
                        r.personal_profile.date_of_birth = e.target.value;
                        return r;
                      })
                    }
                  />
                </div>

                <div>
                  <label>Location</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.location}
                    onChange={(e) =>
                      setResumeAtIndex(selectedResumeIndex, (r) => {
                        r.personal_profile.location = e.target.value;
                        return r;
                      })
                    }
                  />
                </div>

                <div>
                  <label>Phone Country Code</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.phone_country_code}
                    onChange={(e) =>
                      setResumeAtIndex(selectedResumeIndex, (r) => {
                        r.personal_profile.phone_country_code = e.target.value;
                        return r;
                      })
                    }
                  />
                </div>

                <div>
                  <label>Phone</label>
                  <input
                    style={{ width: "100%", padding: 8 }}
                    value={currentDraftResume.personal_profile.phone}
                    onChange={(e) =>
                      setResumeAtIndex(selectedResumeIndex, (r) => {
                        r.personal_profile.phone = e.target.value;
                        return r;
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Email</label>
                <input
                  style={{ width: "100%", padding: 8 }}
                  value={currentDraftResume.personal_profile.email}
                  onChange={(e) =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.personal_profile.email = e.target.value;
                      return r;
                    })
                  }
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Website Links (one per line)</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 80 }}
                  value={toLines(currentDraftResume.personal_profile.website_links)}
                  onChange={(e) =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.personal_profile.website_links = fromLines(e.target.value);
                      return r;
                    })
                  }
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Skill Keywords (one per line)</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 80 }}
                  value={toLines(currentDraftResume.personal_profile.skill_keywords)}
                  onChange={(e) =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.personal_profile.skill_keywords = fromLines(e.target.value);
                      return r;
                    })
                  }
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Bio</label>
                <textarea
                  style={{ width: "100%", padding: 8, minHeight: 100 }}
                  value={currentDraftResume.personal_profile.bio}
                  onChange={(e) =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.personal_profile.bio = e.target.value;
                      return r;
                    })
                  }
                />
              </div>
            </div>

            {/* Education History */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Education History</h3>
                <button
                  type="button"
                  onClick={() =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.education_history = [...(r.education_history || []), emptyEducation()];
                      return r;
                    })
                  }
                >
                  Add Education
                </button>
              </div>

              {currentDraftResume.education_history.length === 0 ? (
                <p style={{ color: "#555" }}>0 entries</p>
              ) : (
                currentDraftResume.education_history.map((ed, idx) => (
                  <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>Education #{idx + 1}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          setResumeAtIndex(selectedResumeIndex, (r) => {
                            r.education_history = r.education_history.filter((_, i) => i !== idx);
                            return r;
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Degree Name</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={ed.degree_name ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.education_history[idx].degree_name = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>School Name</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={ed.school_name ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.education_history[idx].school_name = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>Start Time</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={ed.start_time ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.education_history[idx].start_time = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>End Time</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={ed.end_time ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.education_history[idx].end_time = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <label>Descriptions (one per line)</label>
                      <textarea
                        style={{ width: "100%", padding: 8, minHeight: 90 }}
                        value={toLines(ed.descriptions)}
                        onChange={(e) =>
                          setResumeAtIndex(selectedResumeIndex, (r) => {
                            r.education_history[idx].descriptions = fromLines(e.target.value);
                            return r;
                          })
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Work History */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Work History</h3>
                <button
                  type="button"
                  onClick={() =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.work_history = [...(r.work_history || []), emptyWork()];
                      return r;
                    })
                  }
                >
                  Add Work
                </button>
              </div>

              {currentDraftResume.work_history.length === 0 ? (
                <p style={{ color: "#555" }}>0 entries</p>
              ) : (
                currentDraftResume.work_history.map((wk, idx) => (
                  <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>Work #{idx + 1}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          setResumeAtIndex(selectedResumeIndex, (r) => {
                            r.work_history = r.work_history.filter((_, i) => i !== idx);
                            return r;
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Role Name</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={wk.role_name ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.work_history[idx].role_name = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>Company Name</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={wk.company_name ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.work_history[idx].company_name = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>Start Time</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={wk.start_time ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.work_history[idx].start_time = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>

                      <div>
                        <label>End Time</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={wk.end_time ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.work_history[idx].end_time = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <label>Descriptions (one per line)</label>
                      <textarea
                        style={{ width: "100%", padding: 8, minHeight: 90 }}
                        value={toLines(wk.descriptions)}
                        onChange={(e) =>
                          setResumeAtIndex(selectedResumeIndex, (r) => {
                            r.work_history[idx].descriptions = fromLines(e.target.value);
                            return r;
                          })
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Optional Sections */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Optional Items</h3>
                <button
                  type="button"
                  onClick={() =>
                    setResumeAtIndex(selectedResumeIndex, (r) => {
                      r.optional_sections = [...(r.optional_sections || []), emptyOptionalSection()];
                      return r;
                    })
                  }
                >
                  Add Optional Items
                </button>
              </div>

              {currentDraftResume.optional_sections.length === 0 ? (
                <p style={{ color: "#555" }}>0 entries</p>
              ) : (
                currentDraftResume.optional_sections.map((sec, idx) => (
                  <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>Optional Item #{idx + 1}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          setResumeAtIndex(selectedResumeIndex, (r) => {
                            r.optional_sections = r.optional_sections.filter((_, i) => i !== idx);
                            return r;
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label>Item Name (e.g., Projects, Certifications, Anything you like to include...)</label>
                        <input
                          style={{ width: "100%", padding: 8 }}
                          value={sec.section_name ?? ""}
                          onChange={(e) =>
                            setResumeAtIndex(selectedResumeIndex, (r) => {
                              r.optional_sections[idx].section_name = e.target.value;
                              return r;
                            })
                          }
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <label>Content</label>
                      <textarea
                        style={{ width: "100%", padding: 8, minHeight: 110 }}
                        value={sec.content ?? ""}
                        onChange={(e) =>
                          setResumeAtIndex(selectedResumeIndex, (r) => {
                            r.optional_sections[idx].content = e.target.value;
                            return r;
                          })
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* JSON preview */}
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>JSON Preview</h2>

            <p style={{ marginTop: 0, color: "#444" }}>
              Preview shows the current editable draft (what your form currently represents).
            </p>

            <pre style={{ margin: 0, overflow: "auto", maxHeight: 420, background: "#f7f7f7", padding: 12 }}>
              {JSON.stringify({ resumes: draftResumes }, null, 2)}
            </pre>

            {extractedResult && (
              <>
                <h3 style={{ marginTop: 16 }}>Selected History / Latest Import Payload (read-only)</h3>
                <pre style={{ margin: 0, overflow: "auto", maxHeight: 420, background: "#f7f7f7", padding: 12 }}>
                  {JSON.stringify(extractedResult, null, 2)}
                </pre>
              </>
            )}
          </section>
        </div>

        {/* Right: FILE history */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Request History (File)</h3>
            <button onClick={clearHistoryPanel} disabled={isLoading || history.length === 0}>
              Clear All (File)
            </button>
          </div>

          <div style={{ border: "1px solid #ddd" }}>
            {history.length === 0 ? (
              <div style={{ padding: 12 }}>No file requests yet.</div>
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
                      {item.created_at}
                      {typeof item.duration_ms === "number" ? ` • ${item.duration_ms}ms` : ""}
                      {" • "}
                      {item.status}
                      {" • "}
                      {(item.request_type || "file").toUpperCase()}
                      {item.command_name ? ` • ${item.command_name}` : ""}
                    </div>

                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      {(() => {
                        const title = renderHistoryTitle(item);
                        return title.length > 70 ? title.slice(0, 70) + "…" : title;
                      })()}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      {item.file_name ? `File: ${item.file_name}` : ""}
                      {Number.isFinite(item.file_size) ? ` • ${formatBytes(item.file_size)}` : ""}
                      {item.file_mime ? ` • ${item.file_mime}` : ""}
                    </div>
                  </button>

                  <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                    <button onClick={() => deleteHistoryItem(item.id)} disabled={isLoading}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected preview */}
          {selectedHistoryItem ? (
            <>
              <h4 style={{ marginTop: 12 }}>Selected Item Preview</h4>

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
                  if (!selectedHistoryItem.result_json) return "—";
                  try {
                    return JSON.stringify(JSON.parse(selectedHistoryItem.result_json), null, 2);
                  } catch {
                    return selectedHistoryItem.result_json;
                  }
                })()}
              </pre>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

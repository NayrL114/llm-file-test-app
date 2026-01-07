import { useMemo, useState } from "react";

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

export default function ResumeExtractPage() {
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || "", []);

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
    setDraftResumes([emptyResume()]);
    setSelectedResumeIndex(0);
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

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const result = data?.result ?? null;
      setExtractedResult(result);

      const resumes = Array.isArray(result?.resumes) ? result.resumes : [];
      const normalized = resumes.map((r) => normalizeResume(r));

      if (!normalized.length) {
        throw new Error("Extraction returned 0 resumes. Please check the file contents.");
      }

      setDraftResumes((prev) => {
        if (overwriteOnAnalyze) return normalized;

        // If not overwriting, append extracted resumes after the existing ones.
        // (Useful if user started typing, but still wants extracted data to reference.)
        return [...prev.map((r) => cloneDeep(r)), ...normalized];
      });

      // Set selection to first newly imported resume:
      setSelectedResumeIndex((prevIdx) => {
        if (overwriteOnAnalyze) return 0;
        return draftResumes.length; // start of appended block
      });
    } catch (err) {
      setErrorMsg(err?.message || "Failed to analyze the resume.");
    } finally {
      setIsLoading(false);
    }
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
    <div>
      <h1>Resume Extract</h1>
      <p>
        Fill in the application form manually, or import from a resume to pre-fill fields (schema:{" "}
        <code>resume_extraction_v1</code>).
      </p>

      {/* Import (optional) */}
      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Import from Resume (Optional)</h2>

        <input
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

          <button type="button" onClick={resetToEmptyForm}>
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

        {errorMsg && (
          <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
            {errorMsg}
          </div>
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

          <div>
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

        {/* Optional Sections (now behaves like Education/Work: 0..N list with Add/Remove) */}
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

        {/*
        {extractedResult && (
          <>
            <h3 style={{ marginTop: 16 }}>Original Extracted Result (read-only)</h3>
            <pre style={{ margin: 0, overflow: "auto", maxHeight: 420, background: "#f7f7f7", padding: 12 }}>
              {JSON.stringify(extractedResult, null, 2)}
            </pre>
          </>
        )}
          */}
      </section>
    </div>
  );
}

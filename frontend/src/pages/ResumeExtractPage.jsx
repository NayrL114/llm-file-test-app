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

const INDUSTRIES = [
  'Accounting',
  'Agriculture & Farming',
  'Airlines & Aviation',
  'Animation',
  'Architecture & Planning',
  'Arts & Crafts',
  'Automotive',
  'Banking',
  'Biotechnology',
  'Broadcast Media',
  'Building Materials',
  'Business Supplies & Equipment',
  'Chemicals',
  'Civic & Social Organization',
  'Civil Engineering',
  'Commercial Real Estate',
  'Computer & Network Security',
  'Computer Games',
  'Computer Hardware',
  'Computer Networking',
  'Computer Software',
  'Construction',
  'Consumer Electronics',
  'Consumer Goods',
  'Consumer Services',
  'Cosmetics',
  'Dairy',
  'Defense & Space',
  'Design',
  'E-Learning',
  'Education Management',
  'Electrical & Electronic Manufacturing',
  'Entertainment',
  'Environmental Services',
  'Events Services',
  'Executive Office',
  'Facilities Services',
  'Farming',
  'Financial Services',
  'Fine Art',
  'Fishery',
  'Food & Beverages',
  'Food Production',
  'Fundraising',
  'Furniture',
  'Gambling & Casinos',
  'Glass, Ceramics & Concrete',
  'Government Administration',
  'Government Relations',
  'Graphic Design',
  'Health, Wellness & Fitness',
  'Healthcare',
  'Higher Education',
  'Hospital & Health Care',
  'Hospitality',
  'Human Resources',
  'Import & Export',
  'Individual & Family Services',
  'Industrial Automation',
  'Information Services',
  'Information Technology & Services',
  'Insurance',
  'International Affairs',
  'International Trade & Development',
  'Internet',
  'Investment Banking',
  'Investment Management',
  'Judiciary',
  'Law Enforcement',
  'Law Practice',
  'Legal Services',
  'Legislative Office',
  'Leisure, Travel & Tourism',
  'Libraries',
  'Logistics & Supply Chain',
  'Luxury Goods & Jewelry',
  'Machinery',
  'Management Consulting',
  'Manufacturing',
  'Maritime',
  'Market Research',
  'Marketing & Advertising',
  'Mechanical or Industrial Engineering',
  'Media Production',
  'Medical Devices',
  'Medical Practice',
  'Mental Health Care',
  'Military',
  'Mining & Metals',
  'Motion Pictures & Film',
  'Museums & Institutions',
  'Music',
  'Nanotechnology',
  'Newspapers',
  'Non-Profit Organization Management',
  'Oil & Energy',
  'Online Media',
  'Outsourcing/Offshoring',
  'Package/Freight Delivery',
  'Packaging & Containers',
  'Paper & Forest Products',
  'Performing Arts',
  'Pharmaceuticals',
  'Philanthropy',
  'Photography',
  'Plastics',
  'Political Organization',
  'Primary/Secondary Education',
  'Printing',
  'Professional Training & Coaching',
  'Program Development',
  'Public Policy',
  'Public Relations & Communications',
  'Public Safety',
  'Publishing',
  'Railroad Manufacture',
  'Ranching',
  'Real Estate',
  'Recreational Facilities & Services',
  'Religious Institutions',
  'Renewables & Environment',
  'Research',
  'Restaurants',
  'Retail',
  'Security & Investigations',
  'Semiconductors',
  'Shipbuilding',
  'Sporting Goods',
  'Sports',
  'Staffing & Recruiting',
  'Supermarkets',
  'Telecommunications',
  'Textiles',
  'Think Tanks',
  'Tobacco',
  'Translation & Localization',
  'Transportation/Trucking/Railroad',
  'Utilities',
  'Venture Capital & Private Equity',
  'Veterinary',
  'Warehousing',
  'Wholesale',
  'Wine & Spirits',
  'Wireless',
  'Writing & Editing',
  'Other'
];
const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua & Barbuda',
  'Argentina',
  'Armenia',
  'Aruba',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia & Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China Mainland',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cura?ao',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Faroe Islands',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Greenland',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Hong Kong',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macau',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Montserrat',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Helena',
  'Saint Kitts & Nevis',
  'Saint Lucia',
  'Saint Vincent',
  'Samoa',
  'San Marino',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad & Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
];
const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Freelance", "Internship"];
const CONTRACT_TYPES = ["Full time", "Part time", "Fixed-term contract", "Others"];
const WORK_MODES = ["Onsite", "Remote", "Hybrid"];
const GRADE_TYPES = [
  "GPA (4.0 scale)",
  "CGPS",
  "Percentage",
  "Letter Grade (A, B, C)",
  "Pass / Fail",
  "Other",
];

function isEmpty(value) {
  return String(value || "").trim() === "";
}

function getFileMeta(file) {
  if (!file) {
    return { name: "", type: "", size: "" };
  }
  return {
    name: file.name || "",
    type: file.type || "",
    size: String(file.size || ""),
  };
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
    work_experience: [],
    education_history: [],
    licenses_certificates: [],
    optional_sections: [],
  };
}

function normalizeResume(resume) {
  const r = resume || {};
  const legacyWork = Array.isArray(r.work_history) ? r.work_history : [];
  const rawEducation = Array.isArray(r.education_history) ? r.education_history : [];
  const workExperience =
    Array.isArray(r.work_experience) && r.work_experience.length > 0
      ? r.work_experience
      : legacyWork.map((wk) => ({
          job_title: wk?.role_name ?? "",
          company_name: wk?.company_name ?? "",
          location: "",
          industry: "",
          employment_type: "",
          contract_type: "",
          work_mode: "",
          start_date: wk?.start_time ?? "",
          end_date: wk?.end_time ?? "",
          is_current: "",
          job_description: Array.isArray(wk?.descriptions) ? wk.descriptions.join("\n") : "",
          supporting_document_name: "",
          supporting_document_type: "",
          supporting_document_size: "",
        }));
  const shouldMapEducation =
    rawEducation.length > 0 &&
    rawEducation.some((ed) => ed?.start_time || ed?.end_time || Array.isArray(ed?.descriptions));
  const educationHistory =
    rawEducation.length > 0 && !shouldMapEducation
      ? rawEducation
      : rawEducation.map((ed) => ({
          degree_name: ed?.degree_name ?? "",
          school_name: ed?.school_name ?? "",
          location_country: "",
          location_state: "",
          start_date: ed?.start_time ?? "",
          end_date: ed?.end_time ?? "",
          is_current: "",
          grade_year: "",
          grade_type: "",
          grade_value: "",
          description: Array.isArray(ed?.descriptions) ? ed.descriptions.join("\n") : "",
          supporting_document_name: "",
          supporting_document_type: "",
          supporting_document_size: "",
        }));

  return {
    personal_profile: {
      first_name: r.personal_profile?.first_name ?? "",
      last_name: r.personal_profile?.last_name ?? "",
      date_of_birth: r.personal_profile?.date_of_birth ?? "",
      phone_country_code: r.personal_profile?.phone_country_code ?? "",
      phone: r.personal_profile?.phone ?? "",
      email: r.personal_profile?.email ?? "",
      location: r.personal_profile?.location ?? "",
      website_links: Array.isArray(r.personal_profile?.website_links) ? r.personal_profile.website_links : [],
      skill_keywords: Array.isArray(r.personal_profile?.skill_keywords) ? r.personal_profile.skill_keywords : [],
      bio: r.personal_profile?.bio ?? "",
    },
    work_experience: workExperience,
    education_history: educationHistory,
    licenses_certificates: Array.isArray(r.licenses_certificates) ? r.licenses_certificates : [],
    optional_sections: Array.isArray(r.optional_sections) ? r.optional_sections : [],
  };
}

function emptyEducation() {
  return {
    degree_name: "",
    school_name: "",
    location_country: "",
    location_state: "",
    start_date: "",
    end_date: "",
    is_current: "",
    grade_year: "",
    grade_type: "",
    grade_value: "",
    description: "",
    supporting_document_name: "",
    supporting_document_type: "",
    supporting_document_size: "",
  };
}

function emptyWork() {
  return {
    job_title: "",
    company_name: "",
    location: "",
    industry: "",
    employment_type: "",
    contract_type: "",
    work_mode: "",
    start_date: "",
    end_date: "",
    is_current: "",
    job_description: "",
    supporting_document_name: "",
    supporting_document_type: "",
    supporting_document_size: "",
  };
}

function emptyLicense() {
  return {
    qualification_name: "",
    issuing_organisation: "",
    issue_location_country: "",
    issue_location_state: "",
    issue_date: "",
    end_date: "",
    permanent_valid: "",
    last_renewal_date: "",
    industry: "",
    certificate_file_name: "",
    certificate_file_type: "",
    certificate_file_size: "",
  };
}

function emptyOptionalSection() {
  return {
    section_name: "",
    content: "",
  };
}

function withErrorStyle(base, hasError) {
  if (!hasError) return base;
  return { ...base, borderColor: "crimson", outlineColor: "crimson" };
}

function validateResume(resume) {
  if (!resume) return [];
  const errors = [];

  const workItems = Array.isArray(resume.work_experience) ? resume.work_experience : [];
  workItems.forEach((wk, idx) => {
    const prefix = `Work Experience #${idx + 1}`;
    if (isEmpty(wk.job_title)) errors.push(`${prefix}: Job Title is required`);
    if (isEmpty(wk.company_name)) errors.push(`${prefix}: Company Name is required`);
    if (isEmpty(wk.industry)) errors.push(`${prefix}: Industry is required`);
    if (isEmpty(wk.start_date)) errors.push(`${prefix}: Employment Start Date is required`);
    const isCurrent = String(wk.is_current || "").toLowerCase() === "true";
    if (!isCurrent && isEmpty(wk.end_date)) errors.push(`${prefix}: End Date is required unless currently working`);
  });

  const educationItems = Array.isArray(resume.education_history) ? resume.education_history : [];
  educationItems.forEach((ed, idx) => {
    const prefix = `Education #${idx + 1}`;
    if (isEmpty(ed.degree_name)) errors.push(`${prefix}: Degree Name is required`);
    if (isEmpty(ed.school_name)) errors.push(`${prefix}: School Name is required`);
    if (isEmpty(ed.location_country)) errors.push(`${prefix}: Country is required`);
    if (isEmpty(ed.location_state)) errors.push(`${prefix}: State is required`);
    if (isEmpty(ed.start_date)) errors.push(`${prefix}: Start Date is required`);
    const isCurrent = String(ed.is_current || "").toLowerCase() === "true";
    if (!isCurrent && isEmpty(ed.end_date)) errors.push(`${prefix}: End Date is required unless currently studying`);
  });

  const licenseItems = Array.isArray(resume.licenses_certificates) ? resume.licenses_certificates : [];
  licenseItems.forEach((lc, idx) => {
    const prefix = `License/Certificate #${idx + 1}`;
    if (isEmpty(lc.qualification_name)) errors.push(`${prefix}: Qualification Name is required`);
    if (isEmpty(lc.issuing_organisation)) errors.push(`${prefix}: Issuing Organisation is required`);
    if (isEmpty(lc.issue_location_country)) errors.push(`${prefix}: Country is required`);
    if (isEmpty(lc.issue_location_state)) errors.push(`${prefix}: State is required`);
    if (isEmpty(lc.issue_date)) errors.push(`${prefix}: Issue Date is required`);
    const isPermanent = String(lc.permanent_valid || "").toLowerCase() === "true";
    if (!isPermanent && isEmpty(lc.end_date)) errors.push(`${prefix}: End Date is required unless permanently valid`);
  });

  return errors;
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
  const [showValidation, setShowValidation] = useState(false);

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

  const validationErrors = useMemo(() => {
    if (!currentDraftResume) return [];
    return validateResume(currentDraftResume);
  }, [currentDraftResume]);

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
    setShowValidation(false);
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
      fd.append("command", "resume-extract-v2.json");
      
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
      // The JSON schema in resume-extract-v2.json returns { "resumes": [...] }
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

            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setShowValidation(true)}>
                Validate Required Fields
              </button>
              {showValidation && validationErrors.length === 0 && (
                <span style={{ color: "green", fontWeight: 600 }}>All required fields look good.</span>
              )}
            </div>

            {showValidation && validationErrors.length > 0 && (
              <div style={{ marginBottom: 12, color: "crimson" }}>
                <strong>Missing required fields:</strong>
                <ul style={{ margin: "8px 0 0 18px" }}>
                  {validationErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

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
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history = [...(r.education_history || []), emptyEducation()]; return r; })}>Add Education</button>
              </div>
              {currentDraftResume.education_history.map((ed, idx) => {
                const isCurrent = String(ed.is_current || "").toLowerCase() === "true";
                return (
                  <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Entry #{idx + 1}</strong>
                      <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history = r.education_history.filter((_, i) => i !== idx); return r; })}>Remove</button>
                    </div>
                    <label>Degree Name *</label>
                    <input placeholder="Degree Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.degree_name))} value={ed.degree_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].degree_name = e.target.value; return r; })} />
                    <label>School Name *</label>
                    <input placeholder="School Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.school_name))} value={ed.school_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].school_name = e.target.value; return r; })} />
                    <label>Country *</label>
                    <select style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.location_country))} value={ed.location_country} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].location_country = e.target.value; return r; })}>
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <label>State *</label>
                    <input placeholder="State" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(ed.location_state))} value={ed.location_state} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].location_state = e.target.value; return r; })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Start Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(ed.start_date))} value={ed.start_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].start_date = e.target.value; return r; })} />
                      </div>
                      <div>
                        <label>End Date (or expected) *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && !isCurrent && isEmpty(ed.end_date))} value={ed.end_date} disabled={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].end_date = e.target.value; if (e.target.value) r.education_history[idx].is_current = ""; return r; })} />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <input type="checkbox" checked={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].is_current = e.target.checked ? "true" : ""; if (e.target.checked) r.education_history[idx].end_date = ""; return r; })} />
                          I currently study here
                        </label>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <strong>Grade Information (optional)</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                        <div>
                          <label>Year</label>
                          <input placeholder="Year" style={{ width: "100%", padding: 8 }} value={ed.grade_year} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].grade_year = e.target.value; return r; })} />
                        </div>
                        <div>
                          <label>Grade Type</label>
                          <select style={{ width: "100%", padding: 8 }} value={ed.grade_type} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].grade_type = e.target.value; return r; })}>
                            <option value="">Select grade type</option>
                            {GRADE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label>Grade</label>
                        <input placeholder="Grade" style={{ width: "100%", padding: 8 }} value={ed.grade_value} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].grade_value = e.target.value; return r; })} />
                      </div>
                    </div>
                    <label style={{ marginTop: 8, display: "block" }}>Description (optional)</label>
                    <textarea style={{ width: "100%", padding: 8, minHeight: 80 }} value={ed.description} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].description = e.target.value; return r; })} />
                    <div style={{ marginTop: 8 }}>
                      <label>Upload Supporting Document (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => { const meta = getFileMeta(e.target.files?.[0]); setResumeAtIndex(selectedResumeIndex, (r) => { r.education_history[idx].supporting_document_name = meta.name; r.education_history[idx].supporting_document_type = meta.type; r.education_history[idx].supporting_document_size = meta.size; return r; }); }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Work Experience Section */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Work Experience</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience = [...(r.work_experience || []), emptyWork()]; return r; })}>Add Work</button>
              </div>
              {currentDraftResume.work_experience.map((wk, idx) => {
                const isCurrent = String(wk.is_current || "").toLowerCase() === "true";
                return (
                  <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Entry #{idx + 1}</strong>
                      <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience = r.work_experience.filter((_, i) => i !== idx); return r; })}>Remove</button>
                    </div>
                    <label>Job Title *</label>
                    <input placeholder="Job Title" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(wk.job_title))} value={wk.job_title} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].job_title = e.target.value; return r; })} />
                    <label>Company Name *</label>
                    <input placeholder="Company Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(wk.company_name))} value={wk.company_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].company_name = e.target.value; return r; })} />
                    <label>Location (optional)</label>
                    <input placeholder="Location" style={{ width: "100%", padding: 8, marginTop: 8 }} value={wk.location} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].location = e.target.value; return r; })} />
                    <label>Industry *</label>
                    <select style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(wk.industry))} value={wk.industry} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].industry = e.target.value; return r; })}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => (<option key={i} value={i}>{i}</option>))}
                    </select>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Employment Type (optional)</label>
                        <select style={{ width: "100%", padding: 8 }} value={wk.employment_type} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].employment_type = e.target.value; return r; })}>
                          <option value="">Select type</option>
                          {EMPLOYMENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                        </select>
                      </div>
                      <div>
                        <label>Contract Type (optional)</label>
                        <select style={{ width: "100%", padding: 8 }} value={wk.contract_type} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].contract_type = e.target.value; return r; })}>
                          <option value="">Select type</option>
                          {CONTRACT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                        </select>
                      </div>
                      <div>
                        <label>Work Mode (optional)</label>
                        <select style={{ width: "100%", padding: 8 }} value={wk.work_mode} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].work_mode = e.target.value; return r; })}>
                          <option value="">Select mode</option>
                          {WORK_MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Employment Start Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(wk.start_date))} value={wk.start_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].start_date = e.target.value; return r; })} />
                      </div>
                      <div>
                        <label>End Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && !isCurrent && isEmpty(wk.end_date))} value={wk.end_date} disabled={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].end_date = e.target.value; if (e.target.value) r.work_experience[idx].is_current = ""; return r; })} />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <input type="checkbox" checked={isCurrent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].is_current = e.target.checked ? "true" : ""; if (e.target.checked) r.work_experience[idx].end_date = ""; return r; })} />
                          I currently work here
                        </label>
                      </div>
                    </div>
                    <label style={{ marginTop: 8, display: "block" }}>Job Description (optional)</label>
                    <textarea style={{ width: "100%", padding: 8, minHeight: 80 }} value={wk.job_description} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].job_description = e.target.value; return r; })} />
                    <div style={{ marginTop: 8 }}>
                      <label>Upload Supporting Document (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => { const meta = getFileMeta(e.target.files?.[0]); setResumeAtIndex(selectedResumeIndex, (r) => { r.work_experience[idx].supporting_document_name = meta.name; r.work_experience[idx].supporting_document_type = meta.type; r.work_experience[idx].supporting_document_size = meta.size; return r; }); }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* License / Certificate Section */}
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>License / Certificate</h3>
                <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates = [...(r.licenses_certificates || []), emptyLicense()]; return r; })}>Add License/Certificate</button>
              </div>
              {currentDraftResume.licenses_certificates.map((lc, idx) => {
                const isPermanent = String(lc.permanent_valid || "").toLowerCase() === "true";
                return (
                  <div key={idx} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Entry #{idx + 1}</strong>
                      <button type="button" onClick={() => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates = r.licenses_certificates.filter((_, i) => i !== idx); return r; })}>Remove</button>
                    </div>
                    <label>Qualification Name *</label>
                    <input placeholder="Qualification Name" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.qualification_name))} value={lc.qualification_name} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].qualification_name = e.target.value; return r; })} />
                    <label>Issuing Organisation *</label>
                    <input placeholder="Issuing Organisation" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.issuing_organisation))} value={lc.issuing_organisation} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issuing_organisation = e.target.value; return r; })} />
                    <label>Issue Country *</label>
                    <select style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.issue_location_country))} value={lc.issue_location_country} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issue_location_country = e.target.value; return r; })}>
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <label>Issue State *</label>
                    <input placeholder="State" style={withErrorStyle({ width: "100%", padding: 8, marginTop: 8 }, showValidation && isEmpty(lc.issue_location_state))} value={lc.issue_location_state} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issue_location_state = e.target.value; return r; })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <label>Issue Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && isEmpty(lc.issue_date))} value={lc.issue_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].issue_date = e.target.value; return r; })} />
                      </div>
                      <div>
                        <label>End Date *</label>
                        <input type="date" style={withErrorStyle({ width: "100%", padding: 8 }, showValidation && !isPermanent && isEmpty(lc.end_date))} value={lc.end_date} disabled={isPermanent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].end_date = e.target.value; if (e.target.value) r.licenses_certificates[idx].permanent_valid = ""; return r; })} />
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <input type="checkbox" checked={isPermanent} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].permanent_valid = e.target.checked ? "true" : ""; if (e.target.checked) r.licenses_certificates[idx].end_date = ""; return r; })} />
                          Permanent Valid
                        </label>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Last Renewal Date (if applicable)</label>
                      <input type="date" style={{ width: "100%", padding: 8, marginTop: 8 }} value={lc.last_renewal_date} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].last_renewal_date = e.target.value; return r; })} />
                    </div>
                    <label style={{ marginTop: 8, display: "block" }}>Industry (optional)</label>
                    <select style={{ width: "100%", padding: 8 }} value={lc.industry} onChange={(e) => setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].industry = e.target.value; return r; })}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => (<option key={i} value={i}>{i}</option>))}
                    </select>
                    <div style={{ marginTop: 8 }}>
                      <label>Upload Certificate File (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => { const meta = getFileMeta(e.target.files?.[0]); setResumeAtIndex(selectedResumeIndex, (r) => { r.licenses_certificates[idx].certificate_file_name = meta.name; r.licenses_certificates[idx].certificate_file_type = meta.type; r.licenses_certificates[idx].certificate_file_size = meta.size; return r; }); }} />
                    </div>
                  </div>
                );
              })}
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

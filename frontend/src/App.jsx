import { Routes, Route, Link, Navigate } from "react-router-dom";
import ChatConsolePage from "./pages/ChatConsolePage";
import ResumeExtractPage from "./pages/ResumeExtractPage";

export default function App() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/">Chat Console</Link>
          <Link to="/resume">Resume Extract</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<ChatConsolePage />} />
        <Route path="/resume" element={<ResumeExtractPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

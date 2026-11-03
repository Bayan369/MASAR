import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Demo from "./demo/Demo";

// Old bookmarked URLs remain usable without mounting any auth provider or SDK.
function ExistingLink() {
  const { pathname, search } = useLocation();
  const path = pathname.replace(/^\/demo(?=\/|$)/, "") || "/";
  return <Navigate to={path + search} replace />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/demo/*" element={<ExistingLink />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<Navigate to="/" replace />} />
      <Route
        path="/knowledge/*"
        element={<Navigate to="/documents" replace />}
      />
      <Route path="/*" element={<Demo />} />
    </Routes>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { DisplayPage, NewDisplayRedirect } from "./display/DisplayPage.tsx";
import { StatusMessage } from "./display/StatusMessage.tsx";

export const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/d" replace />} />
    <Route path="/d" element={<NewDisplayRedirect />} />
    <Route path="/d/:displayId" element={<DisplayPage />} />
    <Route path="*" element={<StatusMessage title="NOT FOUND" detail="Open /d to start a display" />} />
  </Routes>
);

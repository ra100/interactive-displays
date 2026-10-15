import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DisplayPage, NewDisplayRedirect } from "./display/DisplayPage.tsx";
import { StatusMessage } from "./display/StatusMessage.tsx";

// Tools load on demand, so a display downloads only what it renders.
const GalleryPage = lazy(async () => ({ default: (await import("./gallery/GalleryPage.tsx")).GalleryPage }));
const OperatorPage = lazy(async () => ({ default: (await import("./operator/OperatorPage.tsx")).OperatorPage }));

const loading = <StatusMessage title="LOADING" />;

export const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/d" replace />} />
    <Route path="/d" element={<NewDisplayRedirect />} />
    <Route path="/d/:displayId" element={<DisplayPage />} />
    <Route
      path="/gallery"
      element={
        <Suspense fallback={loading}>
          <GalleryPage />
        </Suspense>
      }
    />
    <Route
      path="/operator"
      element={
        <Suspense fallback={loading}>
          <OperatorPage />
        </Suspense>
      }
    />
    <Route path="*" element={<StatusMessage title="NOT FOUND" detail="Open /d to start a display" />} />
  </Routes>
);

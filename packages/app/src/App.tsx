import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DisplayPage, NewDisplayRedirect } from "./display/DisplayPage.tsx";
import { StatusMessage } from "./display/StatusMessage.tsx";

// Tools load on demand, so a display downloads only what it renders.
const GalleryPage = lazy(async () => ({ default: (await import("./gallery/GalleryPage.tsx")).GalleryPage }));
const OperatorPage = lazy(async () => ({ default: (await import("./operator/OperatorPage.tsx")).OperatorPage }));
const LibraryPage = lazy(async () => ({ default: (await import("./builder/library/LibraryPage.tsx")).LibraryPage }));
const EditorPage = lazy(async () => ({ default: (await import("./builder/editor/EditorPage.tsx")).EditorPage }));

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
    <Route
      path="/builder"
      element={
        <Suspense fallback={loading}>
          <LibraryPage />
        </Suspense>
      }
    />
    <Route
      path="/builder/:screenId"
      element={
        <Suspense fallback={loading}>
          <EditorPage />
        </Suspense>
      }
    />
    <Route path="*" element={<StatusMessage title="NOT FOUND" detail="Open /d to start a display" />} />
  </Routes>
);

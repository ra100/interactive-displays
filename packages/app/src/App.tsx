import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DisplayProvider } from "./context/DisplayContext";
import { DisplayScreen } from "./display/DisplayScreen";

function BuilderPlaceholder() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#1a1a1a",
        color: "#fff",
        fontFamily: "system-ui",
      }}
    >
      Builder coming in Phase 3
    </div>
  );
}

export function App() {
  return (
    <DisplayProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DisplayScreen />} />
          <Route path="/builder" element={<BuilderPlaceholder />} />
        </Routes>
      </BrowserRouter>
    </DisplayProvider>
  );
}

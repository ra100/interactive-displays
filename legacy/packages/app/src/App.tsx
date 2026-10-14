import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DisplayProvider } from "./context/DisplayContext";
import { DisplayScreen } from "./display/DisplayScreen";
import { BuilderPage } from "./builder/BuilderPage";

export function App() {
  return (
    <DisplayProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DisplayScreen />} />
          <Route path="/builder" element={<BuilderPage />} />
        </Routes>
      </BrowserRouter>
    </DisplayProvider>
  );
}

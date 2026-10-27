import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@openuidev/react-ui";
import "@openuidev/react-ui/index.css";
import { App } from "./App";
createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <App />
    </main>
  </ThemeProvider>,
);

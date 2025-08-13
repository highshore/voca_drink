import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GlobalStyle } from "./ui/GlobalStyle";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

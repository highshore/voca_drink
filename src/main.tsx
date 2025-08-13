import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GlobalStyle } from "./ui/GlobalStyle";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { I18nProvider } from "./i18n/I18nContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <AuthProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AuthProvider>
  </StrictMode>
);

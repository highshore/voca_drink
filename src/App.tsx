import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useMemo } from "react";
import { RootLayout } from "./layouts/RootLayout";
import { HomePage } from "./pages/HomePage";
import { LearnPage } from "./pages/LearnPage";
import { ReviewPage } from "./pages/ReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { Protected } from "./components/Protected";
import { DashboardPage } from "./pages/DashboardPage";
import { DecksPage } from "./pages/DecksPage";
import { VocabListPage } from "./pages/VocabListPage";
import { VocabDetailPage } from "./pages/VocabDetailPage";

function App() {
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: "/",
          element: <RootLayout />,
          children: [
            { index: true, element: <HomePage /> },
            { path: "decks", element: <DecksPage /> },
            { path: "vocab", element: <VocabListPage /> },
            { path: "vocab/:id", element: <VocabDetailPage /> },
            {
              path: "learn",
              element: (
                <Protected>
                  <LearnPage />
                </Protected>
              ),
            },
            {
              path: "review",
              element: (
                <Protected>
                  <ReviewPage />
                </Protected>
              ),
            },
            {
              path: "dashboard",
              element: (
                <Protected>
                  <DashboardPage />
                </Protected>
              ),
            },
            { path: "login", element: <LoginPage /> },
          ],
        },
      ]),
    []
  );

  return <RouterProvider router={router} />;
}

export default App;

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
import { ProfilePage } from "./pages/ProfilePage";
import { VocabDetailPage } from "./pages/VocabDetailPage";
import { VeoVideoPage } from "./pages/VeoVideoPage";

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
            {
              path: "profile",
              element: (
                <Protected>
                  <ProfilePage />
                </Protected>
              ),
            },
            { path: "login", element: <LoginPage /> },
            { path: "veo", element: <VeoVideoPage /> },
          ],
        },
      ]),
    []
  );

  return <RouterProvider router={router} />;
}

export default App;

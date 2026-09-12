import { Navigate, Route, Routes } from "react-router-dom";
import { PlatformRole } from "@kldsim/shared";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { useAuthStore } from "./state/authStore";
import LoginPage from "./routes/LoginPage";
import RegisterPage from "./routes/RegisterPage";
import StudioListPage from "./routes/StudioListPage";
import StudioGeneratePage from "./routes/StudioGeneratePage";
import ScenarioEditorPage from "./routes/ScenarioEditorPage";
import SessionsListPage from "./routes/SessionsListPage";
import SessionLobbyPage from "./routes/SessionLobbyPage";
import PlayPage from "./routes/PlayPage";
import WarRoomPage from "./routes/WarRoomPage";
import DebriefPage from "./routes/DebriefPage";
import DocsPage from "./routes/DocsPage";

const STAFF_ROLES = [PlatformRole.PLATFORM_ADMIN, PlatformRole.FACILITATOR];

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  const isStaff = user && STAFF_ROLES.includes(user.role);
  return <Navigate to={isStaff ? "/studio" : "/sessions"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="sessions" element={<SessionsListPage />} />
          <Route path="sessions/:sessionId/lobby" element={<SessionLobbyPage />} />
          <Route path="sessions/:sessionId/play" element={<PlayPage />} />
          <Route path="sessions/:sessionId/debrief" element={<DebriefPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="docs/:slug" element={<DocsPage />} />

          <Route element={<ProtectedRoute allow={STAFF_ROLES} />}>
            <Route path="studio" element={<StudioListPage />} />
            <Route path="studio/new" element={<StudioGeneratePage />} />
            <Route path="studio/:scenarioId" element={<ScenarioEditorPage />} />
            <Route path="sessions/:sessionId/war-room" element={<WarRoomPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

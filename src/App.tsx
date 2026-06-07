import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const ArcadeHub = lazy(() => import('./pages/ArcadeHub'));
const ArcadeGame = lazy(() => import('./pages/ArcadeGame'));
const ArcadeLeaderboard = lazy(() => import('./pages/ArcadeLeaderboard'));

export default function App() {
  return (
    <Suspense fallback={<div className="loading">Loading…</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/arcade" replace />} />
        <Route path="/arcade" element={<ArcadeHub />} />
        <Route path="/arcade/:slug" element={<ArcadeGame />} />
        <Route path="/arcade/:slug/leaderboard" element={<ArcadeLeaderboard />} />
        <Route path="*" element={<Navigate to="/arcade" replace />} />
      </Routes>
    </Suspense>
  );
}

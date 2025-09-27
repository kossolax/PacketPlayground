import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './layout/sidebar.tsx';
import Home from './pages/Home.tsx';

const Theme = lazy(() => import('./pages/Theme'));

const TcpSyn = lazy(() => import('./pages/TcpSyn'));
const TcpFin = lazy(() => import('./pages/TcpFin'));
const GoBackN = lazy(() => import('./pages/GoBackN'));
const SelectiveRepeat = lazy(() => import('./pages/SelectiveRepeat'));

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="gobackn" element={<GoBackN />} />
          <Route path="tcp-syn" element={<TcpSyn />} />
          <Route path="tcp-fin" element={<TcpFin />} />
          <Route path="selectiverepeat" element={<SelectiveRepeat />} />
          <Route path="theme" element={<Theme />} />
        </Route>
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </Suspense>
  );
}

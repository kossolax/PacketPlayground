import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './layout/sidebar.tsx';

const GoBackN = lazy(() => import('./pages/GoBackN'));
const SelectiveRepeat = lazy(() => import('./pages/SelectiveRepeat'));
const Theme = lazy(() => import('./pages/Theme'));

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<h1>Home</h1>} />
          <Route path="gobackn" element={<GoBackN />} />
          <Route path="selectiverepeat" element={<SelectiveRepeat />} />
          <Route path="theme" element={<Theme />} />
        </Route>
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </Suspense>
  );
}

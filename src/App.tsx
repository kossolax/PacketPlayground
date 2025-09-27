import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './layout/sidebar.tsx';
import Home from './pages/Home.tsx';

const Theme = lazy(() => import('./pages/Theme'));
const Transport = lazy(() => import('./features/transport/Transport'));

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="transport/*" element={<Transport />} />
          <Route path="theme" element={<Theme />} />
        </Route>
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </Suspense>
  );
}

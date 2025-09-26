import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import GoBackN from './pages/GoBackN.tsx';
import Theme from './pages/Theme.tsx';

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<h1>Home</h1>} />
        <Route path="/gobackn" element={<GoBackN />} />
        <Route path="/theme" element={<Theme />} />
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </Suspense>
  );
}

import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Theme from './pages/Theme.tsx';

const Example = lazy(() => import('./features/example/Example.tsx'));

export default function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Example />} />
        <Route path="/example" element={<Example />} />
        <Route path="/theme" element={<Theme />} />
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </Suspense>
  );
}

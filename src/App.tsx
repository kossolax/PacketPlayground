import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './layout/sidebar.tsx';
import Home from './pages/Home.tsx';
import LoadingTest from './pages/LoadingTest.tsx';
import NotFound from './pages/NotFound.tsx';

const Theme = lazy(() => import('./pages/Theme'));
const Physical = lazy(() => import('./features/physical/Physical'));
const DataLink = lazy(() => import('./features/datalink/DataLink'));
const Network = lazy(() => import('./features/network/Network'));
const Transport = lazy(() => import('./features/transport/Transport'));

export default function App() {
  return (
    <Routes>
      {/* Hidden test page for loading animation */}
      <Route path="/loading-test" element={<LoadingTest />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="physical/*" element={<Physical />} />
        <Route path="datalink/*" element={<DataLink />} />
        <Route path="network/*" element={<Network />} />
        <Route path="transport/*" element={<Transport />} />
        <Route path="theme" element={<Theme />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

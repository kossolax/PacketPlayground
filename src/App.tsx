import { lazy } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';

import Layout from './layout/sidebar.tsx';
import Home from './pages/Home.tsx';
import NotFound from './pages/NotFound.tsx';

const Theme = lazy(() => import('./pages/Theme'));
const Physical = lazy(() => import('./features/physical/Physical'));
const DataLink = lazy(() => import('./features/datalink/DataLink'));
const Network = lazy(() => import('./features/network/Network'));
const Transport = lazy(() => import('./features/transport/Transport'));
const NetworkDiagram = lazy(
  () => import('./features/network-diagram/NetworkDiagram')
);

export default function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="physical/*" element={<Physical />} />
        <Route path="datalink/*" element={<DataLink />} />
        <Route path="network/*" element={<Network />} />
        <Route path="transport/*" element={<Transport />} />
        <Route
          path="network-diagram"
          element={<NetworkDiagram />}
          handle={{ fullWidth: true }}
        />
        <Route path="theme" element={<Theme />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    )
  );

  return <RouterProvider router={router} />;
}

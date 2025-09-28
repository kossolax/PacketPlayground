import { Route, Routes } from 'react-router-dom';

import QueuingAndLoss from './QueuingAndLoss';

export default function Network() {
  return (
    <Routes>
      <Route path="queuing-and-loss" element={<QueuingAndLoss />} />
      <Route
        path="*"
        element={<div>Select a network layer topic from the sidebar.</div>}
      />
    </Routes>
  );
}

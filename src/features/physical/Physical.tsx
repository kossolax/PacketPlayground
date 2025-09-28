import { Route, Routes } from 'react-router-dom';

import TransmissionVsPropagation from './TransmissionVsPropagation';

export default function Physical() {
  return (
    <Routes>
      <Route
        path="transmission-vs-propagation"
        element={<TransmissionVsPropagation />}
      />
      <Route
        path="*"
        element={<div>Select a physical layer topic from the sidebar.</div>}
      />
    </Routes>
  );
}

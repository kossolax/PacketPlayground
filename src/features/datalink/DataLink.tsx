import { Route, Routes } from 'react-router-dom';

import CsmaCd from './CsmaCd';

export default function DataLink() {
  return (
    <Routes>
      <Route path="csma-cd" element={<CsmaCd />} />
      <Route
        path="*"
        element={<div>Select a data link layer topic from the sidebar.</div>}
      />
    </Routes>
  );
}

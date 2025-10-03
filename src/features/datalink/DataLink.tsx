import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import CsmaCa from './CsmaCa';
import CsmaCd from './CsmaCd';

export default function DataLink() {
  return (
    <Routes>
      <Route path="csma-cd" element={<CsmaCd />} />
      <Route path="csma-ca" element={<CsmaCa />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

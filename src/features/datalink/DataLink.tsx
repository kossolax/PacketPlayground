import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import CsmaCd from './CsmaCd';

export default function DataLink() {
  return (
    <Routes>
      <Route path="csma-cd" element={<CsmaCd />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

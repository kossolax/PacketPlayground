import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import TransmissionVsPropagation from './TransmissionVsPropagation';

export default function Physical() {
  return (
    <Routes>
      <Route
        path="transmission-vs-propagation"
        element={<TransmissionVsPropagation />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

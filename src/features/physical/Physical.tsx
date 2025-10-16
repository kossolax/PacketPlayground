import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import BitVsBaud from './BitVsBaud';
import NetworkTopologyDemo from './NetworkTopologyDemo';
import TransmissionVsPropagation from './TransmissionVsPropagation';

export default function Physical() {
  return (
    <Routes>
      <Route
        path="transmission-vs-propagation"
        element={<TransmissionVsPropagation />}
      />
      <Route path="bit-vs-baud" element={<BitVsBaud />} />
      <Route path="topology" element={<NetworkTopologyDemo />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

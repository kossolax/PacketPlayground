import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import ArpSimulation from './ArpSimulation';
import CsmaCa from './CsmaCa';
import CsmaCd from './CsmaCd';
import SwitchLearning from './SwitchLearning';
import VlanSimulation from './VlanSimulation';

export default function DataLink() {
  return (
    <Routes>
      <Route path="csma-cd" element={<CsmaCd />} />
      <Route path="csma-ca" element={<CsmaCa />} />
      <Route path="switch-learning" element={<SwitchLearning />} />
      <Route path="arp" element={<ArpSimulation />} />
      <Route path="vlan" element={<VlanSimulation />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

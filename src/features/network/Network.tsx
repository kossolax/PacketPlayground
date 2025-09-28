import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import QueuingAndLoss from './QueuingAndLoss';

export default function Network() {
  return (
    <Routes>
      <Route path="queuing-and-loss" element={<QueuingAndLoss />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

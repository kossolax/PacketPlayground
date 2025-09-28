import { Route, Routes } from 'react-router-dom';

import NotFound from '@/pages/NotFound';
import GoBackN from './GoBackN';
import SelectiveRepeat from './SelectiveRepeat';
import TcpFin from './TcpFin';
import TcpSyn from './TcpSyn';

export default function Transport() {
  return (
    <Routes>
      <Route path="tcp-syn" element={<TcpSyn />} />
      <Route path="tcp-fin" element={<TcpFin />} />
      <Route path="go-back-n" element={<GoBackN />} />
      <Route path="selective-repeat" element={<SelectiveRepeat />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

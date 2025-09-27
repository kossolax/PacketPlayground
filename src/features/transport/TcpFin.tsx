import { useEffect } from 'react';

import { useBreadcrumb } from '@/hooks/use-breadcrumb';

export default function TcpFin() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Transport', 'TCP FIN');
  }, [setBreadcrumbs]);
}

import { useEffect } from 'react';

import { useBreadcrumb } from '@/hooks/use-breadcrumb';

export default function TcpSyn() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Transport', 'TCP SYN');
  }, [setBreadcrumbs]);
}

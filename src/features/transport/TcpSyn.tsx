import { useEffect } from 'react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

export default function TcpSyn() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Transport', 'TCP SYN');
  }, [setBreadcrumbs]);

  return (
    <Card>
      <CardHeader />
      <CardContent />
      <CardFooter />
    </Card>
  );
}

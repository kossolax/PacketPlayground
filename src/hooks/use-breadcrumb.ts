import { useContext } from 'react';

import {
  BreadcrumbContext,
  BreadcrumbContextType,
} from '@/providers/breadcrumb-provider';

export function useBreadcrumb(): BreadcrumbContextType {
  const context = useContext(BreadcrumbContext);

  if (!context) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }

  return context;
}

export type { BreadcrumbItem } from '@/providers/breadcrumb-provider';

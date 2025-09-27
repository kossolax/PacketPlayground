import React, { createContext, useCallback, useState } from 'react';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbContextType = {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (...items: Array<string | BreadcrumbItem>) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(
  undefined
);

interface BreadcrumbProviderProps {
  children: React.ReactNode;
}

export function BreadcrumbProvider({ children }: BreadcrumbProviderProps) {
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([
    { label: 'Home', href: '/' },
  ]);

  const setBreadcrumbs = useCallback(
    (...items: Array<string | BreadcrumbItem>) => {
      const newBreadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];

      items.forEach((item) => {
        if (typeof item === 'string') {
          newBreadcrumbs.push({ label: item });
        } else {
          newBreadcrumbs.push(item);
        }
      });

      setBreadcrumbsState(newBreadcrumbs);
    },
    []
  );

  const value = React.useMemo(
    () => ({ breadcrumbs, setBreadcrumbs }),
    [breadcrumbs, setBreadcrumbs]
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export { BreadcrumbContext };

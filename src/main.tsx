import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Toaster } from '@/components/ui/sonner';

import App from './App.tsx';
import './index.css';
import { BreadcrumbProvider } from './providers/breadcrumb-provider.tsx';
import ThemeProvider from './providers/theme-provider.tsx';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <QueryClientProvider client={queryClient}>
        <BreadcrumbProvider>
          <App />
        </BreadcrumbProvider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);

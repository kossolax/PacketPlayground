import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';

import { Toaster } from '@/components/ui/sonner';

import App from './App.tsx';
import './index.css';
import ThemeProvider from './providers/theme-provider.tsx';

const basename = import.meta.env.BASE_URL || '';
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <QueryClientProvider client={queryClient}>
        <Router basename={basename}>
          <App />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);

import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import AppSidebar from '@/components/app-sidebar';
import ThemeToggle from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { LayoutContextType } from '@/hooks/use-title';

export default function Layout() {
  const [title, setTitle] = useState('NetPlay');

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '12rem',
          '--sidebar-width-mobile': '3rem',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-6 space-y-6">
            <Outlet context={{ title, setTitle } satisfies LayoutContextType} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

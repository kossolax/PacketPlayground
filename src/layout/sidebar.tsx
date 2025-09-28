import React from 'react';
import { Link, Outlet } from 'react-router-dom';

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import AppSidebar from '@/components/app-sidebar';
import ThemeToggle from '@/components/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  BreadcrumbItem as BreadcrumbItemType,
  useBreadcrumb,
} from '@/hooks/use-breadcrumb';

function renderBreadcrumbItem(item: BreadcrumbItemType, isLastItem: boolean) {
  if (isLastItem) {
    return (
      <BreadcrumbPage className="text-lg font-semibold tracking-tight">
        {item.label}
      </BreadcrumbPage>
    );
  }

  if (item.href) {
    return (
      <BreadcrumbLink asChild>
        <Link to={item.href} className="text-lg font-semibold tracking-tight">
          {item.label}
        </Link>
      </BreadcrumbLink>
    );
  }

  return (
    <span className="text-lg font-semibold tracking-tight text-muted-foreground">
      {item.label}
    </span>
  );
}

function renderBreadcrumbList(breadcrumbs: BreadcrumbItemType[]) {
  return breadcrumbs.map((item, index) => {
    const isLastItem = index === breadcrumbs.length - 1;
    const showSeparator = index < breadcrumbs.length - 1;

    return (
      <React.Fragment key={item.label}>
        <BreadcrumbItem>
          {renderBreadcrumbItem(item, isLastItem)}
        </BreadcrumbItem>
        {showSeparator && <BreadcrumbSeparator />}
      </React.Fragment>
    );
  });
}

export default function Layout() {
  const { breadcrumbs } = useBreadcrumb();

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
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center">
            <Breadcrumb>
              <BreadcrumbList>
                {renderBreadcrumbList(breadcrumbs)}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-6 space-y-6">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import AppSidebar from '@/components/app-sidebar';

export default function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '10rem',
          '--sidebar-width-mobile': '3rem',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }
    >
      <AppSidebar />
      <SidebarInset>
        <div className="w-full max-w-6xl mx-auto p-4 space-y-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

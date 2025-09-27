import {
  FileOutput,
  Globe,
  IterationCw,
  Link2,
  Play,
  Repeat2,
  Settings,
  Square,
  Truck,
  Zap,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from './ui/badge';

interface SidebarItem {
  title: string;
  url: string;
  icon: React.FC;
}

interface OSILayer {
  name: string;
  icon: React.FC;
  items: SidebarItem[];
}

const osiLayers: OSILayer[] = [
  {
    name: 'Physical',
    icon: Zap,
    items: [],
  },
  {
    name: 'Data Link',
    icon: Link2,
    items: [],
  },
  {
    name: 'Network',
    icon: Globe,
    items: [],
  },
  {
    name: 'Transport',
    icon: Truck,
    items: [
      {
        title: 'TCP SYN',
        url: '/transport/tcp-syn',
        icon: Play,
      },
      {
        title: 'Go-Back-N',
        url: '/transport/go-back-n',
        icon: IterationCw,
      },
      {
        title: 'Selective Repeat',
        url: '/transport/selective-repeat',
        icon: Repeat2,
      },
      {
        title: 'TCP FIN',
        url: '/transport/tcp-fin',
        icon: Square,
      },
    ],
  },
];

const developmentItems: SidebarItem[] = [
  {
    title: 'Theme',
    url: '/theme',
    icon: FileOutput,
  },
];

export default function AppSidebar() {
  const location = useLocation();
  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(`${url}/`);

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader>
        <Link to="/" className="flex flex-row items-center gap-2">
          <Badge className="w-full">NetPlay</Badge>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {osiLayers.map((layer) => (
          <SidebarGroup key={layer.name}>
            <SidebarGroupLabel className="flex items-center gap-2">
              <layer.icon />
              {layer.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {layer.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link
                        to={item.url}
                        className="flex flex-row items-center gap-2"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Settings size={16} />
            Development
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {developmentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link
                      to={item.url}
                      className="flex flex-row items-center gap-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

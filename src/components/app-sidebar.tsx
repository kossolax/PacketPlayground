import {
  FileOutput,
  Globe,
  Handshake,
  IterationCw,
  Link2,
  Play,
  Repeat2,
  Settings,
  Square,
  Truck,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
        url: '/tcp-syn',
        icon: Play,
      },
      {
        title: 'TCP FIN',
        url: '/tcp-fin',
        icon: Square,
      },
      {
        title: 'Go-Back-N',
        url: '/gobackn',
        icon: IterationCw,
      },
      {
        title: 'Selective Repeat',
        url: '/selectiverepeat',
        icon: Repeat2,
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
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader>
        <Badge className="w-full">NetPlay</Badge>
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
                    <SidebarMenuButton asChild>
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
                  <SidebarMenuButton asChild>
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

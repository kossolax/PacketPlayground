import { AlertCircle, Terminal } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import { useTheme } from '@/providers/theme-context';

const tableData = [
  { id: 1, name: 'John Doe', role: 'Developer', status: 'Active' },
  { id: 2, name: 'Jane Smith', role: 'Designer', status: 'Offline' },
  { id: 3, name: 'Mike Johnson', role: 'Manager', status: 'Active' },
];

export default function Theme() {
  const { setBreadcrumbs } = useBreadcrumb();

  React.useEffect(() => {
    setBreadcrumbs('Development', 'Theme');
  }, [setBreadcrumbs]);

  const { theme, setTheme } = useTheme();
  const [switchOn, setSwitchOn] = React.useState(theme === 'dark');
  const [radioValue, setRadioValue] = React.useState('option1');
  const [sliderValue, setSliderValue] = React.useState([50]);
  const [textareaValue, setTextareaValue] = React.useState('');

  React.useEffect(() => {
    setTheme(switchOn ? 'dark' : 'light');
  }, [setTheme, switchOn]);

  return (
    <>
      {/* Couleurs de base */}
      <Card>
        <CardHeader>
          <CardTitle>Couleurs de base</CardTitle>
          <CardDescription>
            Les classes de couleurs principales du thème
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-12 w-full bg-background border rounded-md justify-center items-center flex">
                <p className="text-sm">bg-background</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-12 w-full bg-foreground border rounded-md justify-center items-center flex text-background">
                <p className="text-sm">bg-foreground</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-12 w-full bg-primary border rounded-md justify-center items-center flex text-primary-foreground">
                <p className="text-sm">bg-primary</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-12 w-full bg-secondary border rounded-md justify-center items-center flex text-secondary-foreground">
                <p className="text-sm">bg-secondary</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-12 w-full bg-muted border rounded-md justify-center items-center flex text-foreground">
                <p className="text-sm">bg-muted</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-12 w-full bg-accent border rounded-md justify-center items-center flex text-foreground">
                <p className="text-sm">bg-accent</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo Concepts */}
      <Card>
        <CardHeader>
          <CardTitle>Logo Concepts - NetPlay</CardTitle>
          <CardDescription>
            18 propositions de logo pour l&apos;application (dont 9 optimisées
            pour favicon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sélection finale - Logos favoris */}
          <div className="mb-8 p-6 bg-primary/5 border-2 border-primary/20 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-center">
              Sélection finale
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Logo 2: Network Topology */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Connection lines */}
                    <line
                      x1="30"
                      y1="30"
                      x2="48"
                      y2="48"
                      className="stroke-primary/40"
                      strokeWidth="2"
                    />
                    <line
                      x1="66"
                      y1="30"
                      x2="48"
                      y2="48"
                      className="stroke-primary/40"
                      strokeWidth="2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="30"
                      y2="66"
                      className="stroke-primary/40"
                      strokeWidth="2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="66"
                      y2="66"
                      className="stroke-primary/40"
                      strokeWidth="2"
                    />
                    {/* Network nodes */}
                    <circle
                      cx="48"
                      cy="48"
                      r="10"
                      className="fill-primary stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="7"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="66"
                      cy="30"
                      r="7"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="30"
                      cy="66"
                      r="7"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="66"
                      cy="66"
                      r="7"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    {/* Motion indicator - small packet traveling */}
                    <circle
                      cx="39"
                      cy="39"
                      r="3"
                      className="fill-foreground animate-pulse"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Network Topology</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nœuds connectés + flux de données
                  </p>
                </div>
              </div>

              {/* Logo 16: Globe Network */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Globe circle */}
                    <circle
                      cx="48"
                      cy="48"
                      r="32"
                      className="stroke-primary"
                      strokeWidth="5"
                      fill="none"
                    />
                    {/* Vertical meridian */}
                    <ellipse
                      cx="48"
                      cy="48"
                      rx="12"
                      ry="32"
                      className="stroke-primary/60"
                      strokeWidth="3"
                      fill="none"
                    />
                    {/* Horizontal equator */}
                    <ellipse
                      cx="48"
                      cy="48"
                      rx="32"
                      ry="10"
                      className="stroke-primary/60"
                      strokeWidth="3"
                      fill="none"
                    />
                    {/* Network nodes on globe - positioned on circle r=32 */}
                    <circle
                      cx="48"
                      cy="16"
                      r="5"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="76"
                      cy="32"
                      r="5"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="76"
                      cy="64"
                      r="5"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="48"
                      cy="80"
                      r="5"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="20"
                      cy="64"
                      r="5"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="20"
                      cy="32"
                      r="5"
                      className="fill-accent stroke-background"
                      strokeWidth="2"
                    />
                    {/* Connection lines */}
                    <line
                      x1="48"
                      y1="16"
                      x2="76"
                      y2="32"
                      className="stroke-accent/40"
                      strokeWidth="2"
                    />
                    <line
                      x1="76"
                      y1="32"
                      x2="76"
                      y2="64"
                      className="stroke-accent/40"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Globe Network</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Réseau mondial connecté
                  </p>
                </div>
              </div>

              {/* Logo 18: Hash Hub */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Hash symbol - vertical lines */}
                    <rect
                      x="30"
                      y="20"
                      width="8"
                      height="56"
                      rx="4"
                      className="fill-primary"
                    />
                    <rect
                      x="58"
                      y="20"
                      width="8"
                      height="56"
                      rx="4"
                      className="fill-primary"
                    />
                    {/* Hash symbol - horizontal lines */}
                    <rect
                      x="20"
                      y="30"
                      width="56"
                      height="8"
                      rx="4"
                      className="fill-primary"
                    />
                    <rect
                      x="20"
                      y="58"
                      width="56"
                      height="8"
                      rx="4"
                      className="fill-primary"
                    />
                    {/* Colorful nodes at intersections - style Slack */}
                    <circle cx="34" cy="34" r="7" className="fill-accent" />
                    <circle cx="62" cy="34" r="7" className="fill-primary" />
                    <circle cx="34" cy="62" r="7" className="fill-primary" />
                    <circle cx="62" cy="62" r="7" className="fill-accent" />
                    {/* Inner accent circles for depth */}
                    <circle cx="34" cy="34" r="3" className="fill-background" />
                    <circle cx="62" cy="34" r="3" className="fill-background" />
                    <circle cx="34" cy="62" r="3" className="fill-background" />
                    <circle cx="62" cy="62" r="3" className="fill-background" />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Hash Hub</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Moderne et ludique (style Slack)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Autres propositions */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Autres propositions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Second row of logos */}
              {/* Logo 4: Network Pulse */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Central core */}
                    <circle cx="48" cy="48" r="12" className="fill-primary" />
                    <circle cx="48" cy="48" r="8" className="fill-accent" />
                    {/* Pulse rings expanding outward */}
                    <circle
                      cx="48"
                      cy="48"
                      r="20"
                      className="stroke-primary/60"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="28"
                      className="stroke-primary/40"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="36"
                      className="stroke-primary/20"
                      strokeWidth="2"
                      fill="none"
                    />
                    {/* Data packets radiating outward in 8 directions */}
                    <circle
                      cx="48"
                      cy="12"
                      r="3"
                      className="fill-accent animate-pulse"
                    />
                    <circle
                      cx="76"
                      cy="20"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <circle
                      cx="84"
                      cy="48"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.4s' }}
                    />
                    <circle
                      cx="76"
                      cy="76"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <circle
                      cx="48"
                      cy="84"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.8s' }}
                    />
                    <circle
                      cx="20"
                      cy="76"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '1s' }}
                    />
                    <circle
                      cx="12"
                      cy="48"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '1.2s' }}
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '1.4s' }}
                    />
                    {/* Connecting lines from center to packets */}
                    <line
                      x1="48"
                      y1="48"
                      x2="48"
                      y2="12"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="76"
                      y2="20"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="84"
                      y2="48"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="76"
                      y2="76"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="48"
                      y2="84"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="20"
                      y2="76"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="12"
                      y2="48"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="20"
                      y2="20"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Network Pulse</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pulsation réseau omnidirectionnelle
                  </p>
                </div>
              </div>

              {/* Logo 5: Layered Hexagon */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Outer hexagon layer */}
                    <path
                      d="M 48 12 L 75 28 L 75 60 L 48 76 L 21 60 L 21 28 Z"
                      className="stroke-primary/30 fill-primary/5"
                      strokeWidth="2"
                    />
                    {/* Middle hexagon layer */}
                    <path
                      d="M 48 22 L 67 33 L 67 55 L 48 66 L 29 55 L 29 33 Z"
                      className="stroke-primary/50 fill-primary/10"
                      strokeWidth="2"
                    />
                    {/* Inner hexagon layer */}
                    <path
                      d="M 48 32 L 59 38 L 59 50 L 48 56 L 37 50 L 37 38 Z"
                      className="stroke-primary fill-primary/20"
                      strokeWidth="2.5"
                    />
                    {/* Core center */}
                    <circle cx="48" cy="44" r="6" className="fill-accent" />
                    {/* Data packets at vertices */}
                    <circle
                      cx="48"
                      cy="12"
                      r="3"
                      className="fill-accent animate-pulse"
                    />
                    <circle
                      cx="75"
                      cy="28"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.3s' }}
                    />
                    <circle
                      cx="75"
                      cy="60"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <circle
                      cx="21"
                      cy="28"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.9s' }}
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Layered Protocol</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Architecture en couches réseau
                  </p>
                </div>
              </div>

              {/* Logo 6: Data Stream Arrow */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Main arrow body */}
                    <path
                      d="M 15 48 L 60 48"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    {/* Arrow head */}
                    <path
                      d="M 55 33 L 75 48 L 55 63 Z"
                      className="fill-primary"
                    />
                    {/* Data bits flowing through */}
                    <rect
                      x="20"
                      y="44"
                      width="8"
                      height="8"
                      className="fill-accent animate-pulse"
                      rx="1"
                    />
                    <rect
                      x="32"
                      y="44"
                      width="6"
                      height="8"
                      className="fill-accent animate-pulse"
                      rx="1"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <rect
                      x="42"
                      y="44"
                      width="8"
                      height="8"
                      className="fill-accent animate-pulse"
                      rx="1"
                      style={{ animationDelay: '0.4s' }}
                    />
                    <rect
                      x="54"
                      y="44"
                      width="4"
                      height="8"
                      className="fill-accent/60 animate-pulse"
                      rx="1"
                      style={{ animationDelay: '0.6s' }}
                    />
                    {/* Flow lines */}
                    <path
                      d="M 15 38 L 60 38"
                      className="stroke-primary/30"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    <path
                      d="M 15 58 L 60 58"
                      className="stroke-primary/30"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    {/* Secondary arrow trails */}
                    <path
                      d="M 20 30 L 35 30"
                      className="stroke-accent/40"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 38 30 L 42 30"
                      className="stroke-accent/40"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 20 66 L 35 66"
                      className="stroke-accent/40"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 38 66 L 42 66"
                      className="stroke-accent/40"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Data Stream</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Flux de données directionnel
                  </p>
                </div>
              </div>

              {/* Third row of logos - Equipment & Topologies */}
              {/* Logo 7: Router Hub */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Router body */}
                    <rect
                      x="24"
                      y="38"
                      width="48"
                      height="32"
                      rx="3"
                      className="fill-primary stroke-primary"
                      strokeWidth="2"
                    />
                    {/* Front panel accent */}
                    <rect
                      x="28"
                      y="42"
                      width="40"
                      height="24"
                      rx="2"
                      className="fill-primary/80"
                    />
                    {/* Antennas */}
                    <line
                      x1="36"
                      y1="38"
                      x2="36"
                      y2="22"
                      className="stroke-accent"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="36"
                      cy="20"
                      r="3"
                      className="fill-accent animate-pulse"
                    />
                    <line
                      x1="60"
                      y1="38"
                      x2="60"
                      y2="22"
                      className="stroke-accent"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="60"
                      cy="20"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.5s' }}
                    />
                    {/* LED indicators */}
                    <circle
                      cx="32"
                      cy="48"
                      r="2"
                      className="fill-accent animate-pulse"
                    />
                    <circle
                      cx="38"
                      cy="48"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.3s' }}
                    />
                    <circle
                      cx="44"
                      cy="48"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <circle
                      cx="50"
                      cy="48"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.9s' }}
                    />
                    {/* Ports */}
                    <rect
                      x="30"
                      y="56"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />
                    <rect
                      x="40"
                      y="56"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />
                    <rect
                      x="50"
                      y="56"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />
                    <rect
                      x="60"
                      y="56"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />
                    {/* Data flow - incoming */}
                    <circle
                      cx="14"
                      cy="54"
                      r="2.5"
                      className="fill-accent animate-pulse"
                    />
                    <line
                      x1="16"
                      y1="54"
                      x2="24"
                      y2="54"
                      className="stroke-accent/40"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    {/* Data flow - outgoing */}
                    <circle
                      cx="82"
                      cy="54"
                      r="2.5"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.7s' }}
                    />
                    <line
                      x1="72"
                      y1="54"
                      x2="80"
                      y2="54"
                      className="stroke-accent/40"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Router Hub</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Équipement réseau central
                  </p>
                </div>
              </div>

              {/* Logo 8: Mesh Network */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Perfect pentagon nodes - 5 points equally spaced */}
                    {/* All interconnecting lines (mesh topology) */}
                    <line
                      x1="48"
                      y1="20"
                      x2="75"
                      y2="39"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="48"
                      y1="20"
                      x2="65"
                      y2="71"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="48"
                      y1="20"
                      x2="31"
                      y2="71"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="48"
                      y1="20"
                      x2="21"
                      y2="39"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="75"
                      y1="39"
                      x2="65"
                      y2="71"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="75"
                      y1="39"
                      x2="31"
                      y2="71"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="75"
                      y1="39"
                      x2="21"
                      y2="39"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="65"
                      y1="71"
                      x2="31"
                      y2="71"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="65"
                      y1="71"
                      x2="21"
                      y2="39"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="31"
                      y1="71"
                      x2="21"
                      y2="39"
                      className="stroke-primary/30"
                      strokeWidth="1.5"
                    />
                    {/* Highlighted active paths */}
                    <line
                      x1="48"
                      y1="20"
                      x2="75"
                      y2="39"
                      className="stroke-accent"
                      strokeWidth="2"
                    />
                    <line
                      x1="75"
                      y1="39"
                      x2="65"
                      y2="71"
                      className="stroke-accent"
                      strokeWidth="2"
                    />
                    {/* Network nodes */}
                    <circle
                      cx="48"
                      cy="20"
                      r="6"
                      className="fill-primary stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="75"
                      cy="39"
                      r="6"
                      className="fill-primary stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="65"
                      cy="71"
                      r="6"
                      className="fill-primary stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="31"
                      cy="71"
                      r="6"
                      className="fill-primary stroke-background"
                      strokeWidth="2"
                    />
                    <circle
                      cx="21"
                      cy="39"
                      r="6"
                      className="fill-primary stroke-background"
                      strokeWidth="2"
                    />
                    {/* Data packets traveling */}
                    <circle
                      cx="62"
                      cy="30"
                      r="3"
                      className="fill-accent animate-pulse"
                    />
                    <circle
                      cx="70"
                      cy="55"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.5s' }}
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Mesh Network</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Topologie maillée redondante
                  </p>
                </div>
              </div>

              {/* Logo 9: Server Stack */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Server 1 (top) */}
                    <rect
                      x="20"
                      y="20"
                      width="56"
                      height="16"
                      rx="2"
                      className="fill-primary stroke-primary"
                      strokeWidth="2"
                    />
                    <rect
                      x="24"
                      y="24"
                      width="48"
                      height="8"
                      rx="1"
                      className="fill-primary/70"
                    />
                    {/* LEDs for server 1 */}
                    <circle
                      cx="28"
                      cy="28"
                      r="2"
                      className="fill-accent animate-pulse"
                    />
                    <circle
                      cx="34"
                      cy="28"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <rect
                      x="64"
                      y="26"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />

                    {/* Server 2 (middle) */}
                    <rect
                      x="20"
                      y="40"
                      width="56"
                      height="16"
                      rx="2"
                      className="fill-primary stroke-primary"
                      strokeWidth="2"
                    />
                    <rect
                      x="24"
                      y="44"
                      width="48"
                      height="8"
                      rx="1"
                      className="fill-primary/70"
                    />
                    {/* LEDs for server 2 */}
                    <circle
                      cx="28"
                      cy="48"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.4s' }}
                    />
                    <circle
                      cx="34"
                      cy="48"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.6s' }}
                    />
                    <rect
                      x="64"
                      y="46"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />

                    {/* Server 3 (bottom) */}
                    <rect
                      x="20"
                      y="60"
                      width="56"
                      height="16"
                      rx="2"
                      className="fill-primary stroke-primary"
                      strokeWidth="2"
                    />
                    <rect
                      x="24"
                      y="64"
                      width="48"
                      height="8"
                      rx="1"
                      className="fill-primary/70"
                    />
                    {/* LEDs for server 3 */}
                    <circle
                      cx="28"
                      cy="68"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.8s' }}
                    />
                    <circle
                      cx="34"
                      cy="68"
                      r="2"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '1s' }}
                    />
                    <rect
                      x="64"
                      y="66"
                      width="6"
                      height="4"
                      rx="1"
                      className="fill-background stroke-accent"
                      strokeWidth="1"
                    />

                    {/* Vertical data flow */}
                    <line
                      x1="12"
                      y1="28"
                      x2="12"
                      y2="68"
                      className="stroke-accent/40"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx="12"
                      cy="24"
                      r="3"
                      className="fill-accent animate-pulse"
                    />
                    <circle
                      cx="12"
                      cy="48"
                      r="2.5"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '0.5s' }}
                    />
                    <circle
                      cx="12"
                      cy="72"
                      r="3"
                      className="fill-accent animate-pulse"
                      style={{ animationDelay: '1s' }}
                    />

                    {/* Connection lines between servers */}
                    <line
                      x1="76"
                      y1="32"
                      x2="76"
                      y2="40"
                      className="stroke-accent"
                      strokeWidth="1.5"
                    />
                    <line
                      x1="76"
                      y1="56"
                      x2="76"
                      y2="60"
                      className="stroke-accent"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Server Stack</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Infrastructure data center
                  </p>
                </div>
              </div>

              {/* Fourth row of logos - Favicon Optimized */}
              {/* Logo 12: Connection Node */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Connection lines - very thick */}
                    <line
                      x1="48"
                      y1="22"
                      x2="26"
                      y2="60"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="48"
                      y1="22"
                      x2="70"
                      y2="60"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="26"
                      y1="60"
                      x2="70"
                      y2="60"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    {/* Large nodes */}
                    <circle
                      cx="48"
                      cy="22"
                      r="12"
                      className="fill-accent stroke-background"
                      strokeWidth="3"
                    />
                    <circle
                      cx="26"
                      cy="60"
                      r="12"
                      className="fill-accent stroke-background"
                      strokeWidth="3"
                    />
                    <circle
                      cx="70"
                      cy="60"
                      r="12"
                      className="fill-accent stroke-background"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Network Triangle</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimaliste et bold (favicon-ready)
                  </p>
                </div>
              </div>

              {/* Fifth row of logos - More Favicon Optimized */}
              {/* Logo 15: Broadcast Star */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 flex items-center justify-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Radiating lines - thick */}
                    <line
                      x1="48"
                      y1="48"
                      x2="48"
                      y2="18"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="78"
                      y2="48"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="48"
                      y2="78"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    <line
                      x1="48"
                      y1="48"
                      x2="18"
                      y2="48"
                      className="stroke-primary"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    {/* End points */}
                    <circle cx="48" cy="18" r="6" className="fill-accent" />
                    <circle cx="78" cy="48" r="6" className="fill-accent" />
                    <circle cx="48" cy="78" r="6" className="fill-accent" />
                    <circle cx="18" cy="48" r="6" className="fill-accent" />
                    {/* Center hub - larger */}
                    <circle
                      cx="48"
                      cy="48"
                      r="10"
                      className="fill-accent stroke-background"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-sm">Broadcast Star</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Diffusion omnidirectionnelle
                  </p>
                </div>
              </div>

              {/* Sixth row of logos - Creative & Bold */}
            </div>
          </div>

          {/* Additional note */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Note:</span> Ces
              logos utilisent les couleurs du thème (primary = bleu, accent =
              vert émeraude) et s&apos;adaptent automatiquement au mode
              clair/sombre.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Exemples de composants */}
      <Card>
        <CardHeader>
          <CardTitle>Exemples de composants</CardTitle>
          <CardDescription>
            Composants avec les différentes variantes de couleur
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Buttons */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Buttons</h3>
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Survole-moi</Button>
                  </TooltipTrigger>
                  <TooltipContent>Voici un tooltip ShadCN !</TooltipContent>
                </Tooltip>

                <Button onClick={() => toast('Ceci est un toast ShadCN !')}>
                  Afficher un toast
                </Button>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Badges</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Alerts</h3>
            <div className="space-y-2">
              <Alert>
                <Terminal className="size-4" />
                <AlertTitle>Default Alert</AlertTitle>
                <AlertDescription>
                  This is a default alert using text-foreground
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Destructive Alert</AlertTitle>
                <AlertDescription>
                  This is a destructive alert using destructive colors
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Text Colors */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Text Colors</h3>
            <div className="space-y-2">
              <p className="text-accent">text-accent</p>
              <p className="text-accent-foreground">text-accent-foreground</p>
              <p className="text-foreground">text-foreground (Default text)</p>
              <p className="text-muted">text-muted</p>
              <p className="text-muted-foreground">text-muted-foreground</p>
              <p className="text-primary">text-primary</p>
              <p className="text-secondary">text-secondary</p>
              <p className="text-destructive">text-destructive</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Variants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Card Default</CardTitle>
            <CardDescription>Using bg-card</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-card-foreground">Default card content</p>
          </CardContent>
        </Card>

        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>Card Muted</CardTitle>
            <CardDescription>Using bg-muted</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Muted card content</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Example */}
      <Card>
        <CardHeader>
          <CardTitle>Tabs Example</CardTitle>
          <CardDescription>
            Exemple d&apos;utilisation des onglets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="account" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="mt-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Account Tab Content</h4>
                <p className="text-sm text-muted-foreground">
                  Manage your account settings and preferences.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="password" className="mt-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Password Tab Content</h4>
                <p className="text-sm text-muted-foreground">
                  Change your password and security settings.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Settings Tab Content</h4>
                <p className="text-sm text-muted-foreground">
                  Customize your application settings.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Accordion Example</CardTitle>
          <CardDescription>
            Exemple d&apos;utilisation de l&apos;accordion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full mb-8">
            <AccordionItem value="account">
              <AccordionTrigger>Account</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Account Tab Content</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage your account settings and preferences.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="password">
              <AccordionTrigger>Password</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Password Tab Content</h4>
                  <p className="text-sm text-muted-foreground">
                    Change your password and security settings.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="settings">
              <AccordionTrigger>Settings</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Settings Tab Content</h4>
                  <p className="text-sm text-muted-foreground">
                    Customize your application settings.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Table Example */}
      <Card>
        <CardHeader>
          <CardTitle>Table Example</CardTitle>
          <CardDescription>
            Exemple de tableau avec styles du thème
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Name</th>
                  <th className="py-3 px-4 text-left font-medium">Role</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4">{row.name}</td>
                    <td className="py-3 px-4">{row.role}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          row.status === 'Active' ? 'default' : 'secondary'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Form Example */}
      <Card>
        <CardHeader>
          <CardTitle>Form Example</CardTitle>
          <CardDescription>
            Exemple de formulaire avec les composants shadcn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value="admin" onValueChange={() => {}}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Textarea Example */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder="Tell us about yourself..."
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline">Cancel</Button>
              <Button>Submit</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Switch, Checkbox & Radio, Slider, ...</CardTitle>
          <CardDescription>
            Exemples d&apos;interrupteur, case à cocher et boutons radio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Switch
              checked={switchOn}
              onCheckedChange={setSwitchOn}
              id="theme-switch"
            />
            <Label htmlFor="theme-switch">Switch</Label>
          </div>
          <div className="flex items-center gap-4">
            <Checkbox
              id="newsletter"
              checked={switchOn}
              onCheckedChange={(e) => setSwitchOn(e as boolean)}
            />
            <Label htmlFor="newsletter">Subscribe to newsletter</Label>
          </div>
          <div>
            <RadioGroup
              value={radioValue}
              onValueChange={setRadioValue}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option1" id="radio1" />
                <Label htmlFor="radio1">Option 1</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option2" id="radio2" />
                <Label htmlFor="radio2">Option 2</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option3" id="radio3" />
                <Label htmlFor="radio3">Option 3</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={sliderValue}
              onValueChange={setSliderValue}
              min={0}
              max={100}
              step={1}
              className="w-64"
            />
            <span>{sliderValue[0]}%</span>
          </div>
          <Progress value={sliderValue[0]} className="h-3" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagination Example</CardTitle>
          <CardDescription>Exemple de Pagination</CardDescription>
        </CardHeader>
        <CardContent>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  1
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">2</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">3</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">8</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skeleton Example</CardTitle>
          <CardDescription>
            Exemple de Skeleton pour afficher un chargement élégant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </>
  );
}

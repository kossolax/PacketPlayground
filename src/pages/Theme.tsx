import { AlertCircle, Terminal } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import logo from '@/assets/logo.svg';
import Header from '@/components/header';
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
import { useTheme } from '@/providers/theme-context';

const tableData = [
  { id: 1, name: 'John Doe', role: 'Developer', status: 'Active' },
  { id: 2, name: 'Jane Smith', role: 'Designer', status: 'Offline' },
  { id: 3, name: 'Mike Johnson', role: 'Manager', status: 'Active' },
];

export default function Theme() {
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
      <Header>Thème</Header>
      <img src={logo} alt="Logo" className="w-32 mb-4 mx-auto" />

      <Switch checked={switchOn} onCheckedChange={setSwitchOn} />

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

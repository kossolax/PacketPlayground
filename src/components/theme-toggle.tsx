import { Monitor, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/theme-context';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const renderIcon = () => {
    if (theme === 'light') {
      return <Sun className="h-[1.2rem] w-[1.2rem]" />;
    }
    if (theme === 'dark') {
      return <Moon className="h-[1.2rem] w-[1.2rem]" />;
    }
    return <Monitor className="h-[1.2rem] w-[1.2rem]" />;
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {renderIcon()}
      <span className="sr-only">Toggle theme ({theme})</span>
    </Button>
  );
}

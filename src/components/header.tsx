import { cn } from '@/lib/utils';

type HeaderProps = {
  children?: React.ReactNode;
  level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
} & React.ComponentProps<'div'>;

export default function Header({
  children,
  level = 'h1',
  className,
  ...props
}: HeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-row justify-between items-center w-full',
        className
      )}
      {...props}
    >
      {level === 'h1' && (
        <h1 className="text-3xl font-bold mb-4">{children}</h1>
      )}
      {level === 'h2' && (
        <h2 className="text-2xl font-bold mb-3">{children}</h2>
      )}
      {level === 'h3' && <h3 className="text-xl font-bold mb-2">{children}</h3>}
      {level === 'h4' && <h4 className="text-lg font-bold mb-1">{children}</h4>}
      {level === 'h5' && (
        <h5 className="text-base font-bold mb-1">{children}</h5>
      )}
      {level === 'h6' && <h6 className="text-sm font-bold mb-1">{children}</h6>}
    </div>
  );
}

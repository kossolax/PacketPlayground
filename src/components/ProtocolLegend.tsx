export interface LegendItem {
  color: string;
  label: string;
}

interface ProtocolLegendProps {
  items: LegendItem[];
}

export default function ProtocolLegend({ items }: ProtocolLegendProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-card text-card-foreground px-4 py-2 rounded-lg shadow text-xs border border-border">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded border ${item.color}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

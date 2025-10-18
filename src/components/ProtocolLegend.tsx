export interface LegendItem {
  color: string;
  label: string;
}

interface ProtocolLegendProps {
  items: LegendItem[];
}

export default function ProtocolLegend({ items }: ProtocolLegendProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center justify-center gap-3 bg-card text-card-foreground px-4 py-2 rounded-lg shadow text-xs border border-border">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded border ${item.color}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Card } from "./card";

type EmptyStateProps = {
  action?: React.ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink-950">{title}</h3>
        <p className="max-w-2xl text-sm leading-6 text-ink-700">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </Card>
  );
}

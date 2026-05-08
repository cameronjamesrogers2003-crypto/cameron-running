import Link from "next/link";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const actionNode = !action ? null : action.href ? (
    <Link
      href={action.href}
      className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:brightness-110 active:brightness-95 active:scale-[0.98]"
      style={{
        background: "rgba(45,212,191,0.15)",
        border: "1px solid rgba(45,212,191,0.30)",
        color: "var(--accent)",
      }}
    >
      {action.label}
    </Link>
  ) : (
    <button
      type="button"
      onClick={action.onClick}
      className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:brightness-110 active:brightness-95 active:scale-[0.98]"
      style={{
        background: "rgba(45,212,191,0.15)",
        border: "1px solid rgba(45,212,191,0.30)",
        color: "var(--accent)",
      }}
    >
      {action.label}
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: "rgba(45,212,191,0.10)",
          border: "1px solid rgba(45,212,191,0.20)",
        }}
      >
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm max-w-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {body}
      </p>
      {actionNode}
    </div>
  );
}

interface PageShellProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="space-y-6">
      {(title || description || actions) && (
        <div className="flex items-start justify-between">
          <div>
            {title && (
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

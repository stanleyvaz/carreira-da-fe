/** Cabeçalho padrão das páginas do console: título, descrição e ações. */
export default function PageHead({ title, description, actions, children }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return <header className="pagehead">
    <div>{children}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="actions">{actions}</div>}
  </header>;
}

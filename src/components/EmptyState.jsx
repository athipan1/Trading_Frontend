export default function EmptyState({ icon: Icon, title, description, testId }) {
  return (
    <div className="empty-state" data-testid={testId}>
      <div className="empty-state-icon" aria-hidden="true">
        <Icon />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

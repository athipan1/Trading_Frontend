import { Menu, X } from 'lucide-react';
import { useState } from 'react';

function NavigationButton({ item, activePage, onNavigate, compact = false }) {
  const Icon = item.icon;
  const isActive = activePage === item.id;

  return (
    <button
      className={`app-nav-button${isActive ? ' active' : ''}${compact ? ' compact' : ''}`}
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      data-testid={`nav-${item.id}`}
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}

export default function AppNavigation({
  items,
  activePage,
  onNavigate,
  brand,
  boundaryLabel,
  moreLabel,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const primaryIds = new Set(['overview', 'portfolio', 'system']);
  const primaryItems = items.filter((item) => primaryIds.has(item.id));
  const overflowItems = items.filter((item) => !primaryIds.has(item.id));

  const navigate = (page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar" aria-label={brand.navigationLabel}>
        <div className="sidebar-brand">
          <div className="sidebar-logo" aria-hidden="true">AI</div>
          <div>
            <strong>{brand.title}</strong>
            <span>{brand.subtitle}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavigationButton
              key={item.id}
              item={item}
              activePage={activePage}
              onNavigate={navigate}
            />
          ))}
        </nav>

        <div className="sidebar-boundary">
          <span className="sidebar-boundary-dot" aria-hidden="true" />
          <p>{boundaryLabel}</p>
        </div>
      </aside>

      <div className="app-main">{children}</div>

      <nav className="mobile-bottom-nav" aria-label={brand.navigationLabel}>
        {primaryItems.map((item) => (
          <NavigationButton
            key={item.id}
            item={item}
            activePage={activePage}
            onNavigate={navigate}
            compact
          />
        ))}
        {overflowItems.length ? (
          <button
            className={`app-nav-button compact${overflowItems.some((item) => item.id === activePage) ? ' active' : ''}`}
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-more-navigation"
          >
            <Menu aria-hidden="true" />
            <span>{moreLabel}</span>
          </button>
        ) : null}
      </nav>

      {mobileMenuOpen ? (
        <div className="mobile-nav-overlay" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <section
            id="mobile-more-navigation"
            className="mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={moreLabel}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-nav-sheet-heading">
              <strong>{moreLabel}</strong>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label={brand.closeLabel}>
                <X aria-hidden="true" />
              </button>
            </div>
            <nav>
              {overflowItems.map((item) => (
                <NavigationButton
                  key={item.id}
                  item={item}
                  activePage={activePage}
                  onNavigate={navigate}
                />
              ))}
            </nav>
          </section>
        </div>
      ) : null}
    </div>
  );
}

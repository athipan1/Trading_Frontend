import { Menu, X } from 'lucide-react';
import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const moreButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const restoreFocusRef = useRef(true);
  const initialPageRef = useRef(activePage);
  const primaryIds = new Set(['overview', 'portfolio', 'system']);
  const primaryItems = items.filter((item) => primaryIds.has(item.id));
  const overflowItems = items.filter((item) => !primaryIds.has(item.id));
  const thai = document.documentElement.lang === 'th';
  const skipLabel = thai ? 'ข้ามไปยังเนื้อหาหลัก' : 'Skip to main content';
  const moreNavigationLabel = thai ? 'เมนูเพิ่มเติม' : 'More navigation';

  const focusPageHeading = () => {
    window.requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      const heading = main?.querySelector('h1');
      if (!heading) return;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (initialPageRef.current === activePage) return;
    initialPageRef.current = activePage;
    focusPageHeading();
  }, [activePage]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const dialog = dialogRef.current;
    const appMain = document.querySelector('.app-main');
    const bottomNavigation = document.querySelector('.mobile-bottom-nav');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (appMain) appMain.inert = true;
    if (bottomNavigation) bottomNavigation.inert = true;
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        restoreFocusRef.current = true;
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appMain) appMain.inert = false;
      if (bottomNavigation) bottomNavigation.inert = false;
      if (restoreFocusRef.current) {
        window.requestAnimationFrame(() => previousFocusRef.current?.focus());
      }
      restoreFocusRef.current = true;
    };
  }, [mobileMenuOpen]);

  const openMobileMenu = () => {
    previousFocusRef.current = document.activeElement || moreButtonRef.current;
    restoreFocusRef.current = true;
    setMobileMenuOpen(true);
  };

  const closeMobileMenu = () => {
    restoreFocusRef.current = true;
    setMobileMenuOpen(false);
  };

  const navigate = (page) => {
    restoreFocusRef.current = false;
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  const focusMainContent = (event) => {
    event.preventDefault();
    const main = document.getElementById('main-content');
    main?.focus();
    if (typeof main?.scrollIntoView === 'function') {
      main.scrollIntoView({ block: 'start' });
    }
  };

  const mainContent = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || 'main-content',
        tabIndex: children.props.tabIndex ?? -1,
      })
    : children;

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={focusMainContent}>{skipLabel}</a>
      <div className="app-layout">
        <aside className="app-sidebar" aria-label={brand.navigationLabel}>
          <div className="sidebar-brand">
            <div className="sidebar-logo" aria-hidden="true">AI</div>
            <div>
              <strong>{brand.title}</strong>
              <span>{brand.subtitle}</span>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label={brand.navigationLabel}>
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

        <div className="app-main">{mainContent}</div>

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
              ref={moreButtonRef}
              className={`app-nav-button compact${overflowItems.some((item) => item.id === activePage) ? ' active' : ''}`}
              type="button"
              onClick={openMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-more-navigation"
              aria-haspopup="dialog"
            >
              <Menu aria-hidden="true" />
              <span>{moreLabel}</span>
            </button>
          ) : null}
        </nav>

        {mobileMenuOpen ? (
          <div className="mobile-nav-overlay" role="presentation" onMouseDown={closeMobileMenu}>
            <section
              ref={dialogRef}
              id="mobile-more-navigation"
              className="mobile-nav-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-more-navigation-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mobile-nav-sheet-heading">
                <h2 id="mobile-more-navigation-title">{moreLabel}</h2>
                <button ref={closeButtonRef} type="button" onClick={closeMobileMenu} aria-label={brand.closeLabel}>
                  <X aria-hidden="true" />
                </button>
              </div>
              <nav aria-label={moreNavigationLabel}>
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
    </>
  );
}

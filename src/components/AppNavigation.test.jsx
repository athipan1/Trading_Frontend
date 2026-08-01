import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppNavigation from './AppNavigation.jsx';

function TestIcon() {
  return <svg aria-hidden="true" />;
}

const items = [
  { id: 'overview', label: 'Overview', icon: TestIcon },
  { id: 'portfolio', label: 'Portfolio', icon: TestIcon },
  { id: 'system', label: 'System', icon: TestIcon },
  { id: 'ledger', label: 'Ledger', icon: TestIcon },
];

const brand = {
  title: 'Trading Control',
  subtitle: 'Paper trading observability',
  navigationLabel: 'Main navigation',
  closeLabel: 'Close navigation',
};

function renderNavigation(activePage = 'overview', onNavigate = vi.fn()) {
  return render(
    <AppNavigation
      items={items}
      activePage={activePage}
      onNavigate={onNavigate}
      brand={brand}
      boundaryLabel="Paper-only"
      moreLabel="More"
    >
      <main>
        <h1>{activePage}</h1>
        <button type="button">Main action</button>
      </main>
    </AppNavigation>,
  );
}

describe('AppNavigation accessibility', () => {
  it('moves keyboard focus to main content through the skip link', () => {
    renderNavigation();
    const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
    fireEvent.click(skipLink);
    expect(document.getElementById('main-content')).toHaveFocus();
  });

  it('opens the mobile dialog with focus, closes on Escape, and restores focus', async () => {
    renderNavigation();
    const moreButton = screen.getByRole('button', { name: 'More' });
    moreButton.focus();
    fireEvent.click(moreButton);

    expect(screen.getByRole('dialog', { name: 'More' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument();
    await waitFor(() => expect(moreButton).toHaveFocus());
  });

  it('moves focus to the page heading after route state changes', async () => {
    const onNavigate = vi.fn();
    const view = renderNavigation('overview', onNavigate);

    view.rerender(
      <AppNavigation
        items={items}
        activePage="portfolio"
        onNavigate={onNavigate}
        brand={brand}
        boundaryLabel="Paper-only"
        moreLabel="More"
      >
        <main>
          <h1>Portfolio</h1>
        </main>
      </AppNavigation>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Portfolio' })).toHaveFocus());
  });
});

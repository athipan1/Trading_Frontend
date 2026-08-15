import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AgentGuidePage from './AgentGuidePage.jsx';
import { AGENT_GUIDE, filterAgentGuide } from './agentGuideData.js';

afterEach(cleanup);

describe('Agent Guide workspace', () => {
  it('documents the full agent registry and system flow', () => {
    render(<AgentGuidePage language="en" />);
    expect(screen.getByTestId('page-agent-guide')).toBeVisible();
    expect(AGENT_GUIDE).toHaveLength(14);
    expect(screen.getByTestId('agent-guide-card-manager')).toBeVisible();
    expect(screen.getByTestId('agent-guide-card-risk')).toBeVisible();
    expect(screen.getByTestId('agent-guide-card-backtest')).toBeVisible();
    expect(screen.getAllByTestId(/agent-flow-stage-/)).toHaveLength(6);
  });

  it('filters natural-language rules and opens the matching agent detail', () => {
    render(<AgentGuidePage language="en" />);
    fireEvent.change(screen.getByTestId('agent-guide-search'), {
      target: { value: 'emergency halt' },
    });

    expect(screen.getByTestId('agent-guide-card-risk')).toBeVisible();
    expect(screen.queryByTestId('agent-guide-card-scanner')).not.toBeInTheDocument();
    const detail = screen.getByTestId('agent-guide-detail');
    expect(within(detail).getByText('Risk_Agent')).toBeVisible();
    expect(detail).toHaveTextContent('Emergency halt must be checked at runtime');
  });

  it('renders Thai natural-language explanations', () => {
    render(<AgentGuidePage language="th" />);
    expect(screen.getByText('เข้าใจการทำงานของ AI Agent ทุกตัว')).toBeVisible();
    fireEvent.click(screen.getByTestId('agent-guide-card-profit'));
    const detail = screen.getByTestId('agent-guide-detail');
    expect(detail).toHaveTextContent('ผู้ดูแลวงจรกำไร');
    expect(detail).toHaveTextContent('ห้ามเรียก Execution_Agent โดยตรง');
  });

  it('keeps category filtering deterministic', () => {
    const safety = filterAgentGuide({ category: 'safety' });
    expect(safety.map((agent) => agent.id)).toEqual(['risk']);
    const research = filterAgentGuide({ category: 'research' });
    expect(research.map((agent) => agent.id)).toEqual(['performance', 'learning', 'backtest']);
  });
});

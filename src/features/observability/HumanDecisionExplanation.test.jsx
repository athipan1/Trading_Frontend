import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HumanDecisionExplanation from './HumanDecisionExplanation.jsx';

describe('HumanDecisionExplanation', () => {
  it('renders the what, why, and next-action structure in Thai', () => {
    render(
      <HumanDecisionExplanation
        codes={['risk_rejected']}
        language="th"
        stage="risk"
      />,
    );

    expect(screen.getByText('เกิดอะไรขึ้น')).toBeInTheDocument();
    expect(screen.getByText('Risk ไม่อนุมัติรายการนี้')).toBeInTheDocument();
    expect(screen.getByText('ทำไม')).toBeInTheDocument();
    expect(screen.getByText('ควรทำอะไรต่อ')).toBeInTheDocument();
    expect(screen.getByText('รายละเอียดทางเทคนิค')).toBeInTheDocument();
  });

  it('keeps unknown reason codes visible without manufacturing rationale', () => {
    render(
      <HumanDecisionExplanation
        codes={['future_policy_rule']}
        language="th"
        stage="risk"
      />,
    );

    expect(screen.getByText('Candidate หยุดที่ Risk gate')).toBeInTheDocument();
    expect(screen.getByText(/จะไม่เดาเหตุผล/)).toBeInTheDocument();
    expect(screen.getByText('future_policy_rule')).toBeInTheDocument();
  });

  it('uses concise copy in compact table mode', () => {
    render(
      <HumanDecisionExplanation
        codes={['investability_average_dollar_volume_below_minimum']}
        language="en"
        stage="scanner"
        compact
      />,
    );

    expect(screen.getByText('Trading liquidity is below the minimum')).toBeInTheDocument();
    expect(screen.getByText(/liquidity risk exceeds/)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { explainDecisionReason, explainDecisionReasons } from './reasonExplanations.js';

describe('human-readable trading decision explanations', () => {
  it('explains a Risk rejection in Thai without inventing a broker action', () => {
    const result = explainDecisionReason('risk_rejected', { language: 'th', stage: 'risk' });

    expect(result).toMatchObject({
      code: 'risk_rejected',
      known: true,
      title: 'Risk ไม่อนุมัติรายการนี้',
    });
    expect(result.explanation).toContain('หยุดก่อนส่งคำสั่ง');
    expect(result.action).toContain('reason code');
  });

  it('provides equivalent English copy', () => {
    const result = explainDecisionReason('execution_failed', { language: 'en', stage: 'execution' });

    expect(result.known).toBe(true);
    expect(result.title).toBe('Order execution failed safely');
    expect(result.explanation).toContain('does not treat it as executed');
  });

  it('fails closed for unknown codes instead of guessing a reason', () => {
    const result = explainDecisionReason('future_risk_policy_code', { language: 'th', stage: 'risk' });

    expect(result).toMatchObject({
      code: 'future_risk_policy_code',
      known: false,
      title: 'Candidate หยุดที่ Risk gate',
    });
    expect(result.explanation).toContain('จะไม่เดาเหตุผล');
    expect(result.action).toContain('future_risk_policy_code');
  });

  it('deduplicates repeated reason codes while preserving order', () => {
    const results = explainDecisionReasons(
      ['risk_rejected', 'risk_rejected', 'execution_failed'],
      { language: 'en' },
    );

    expect(results.map((item) => item.code)).toEqual(['risk_rejected', 'execution_failed']);
  });
});

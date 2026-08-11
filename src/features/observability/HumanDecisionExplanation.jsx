import { explainDecisionReasons } from './reasonExplanations.js';
import './humanDecisionExplanation.css';

const LABELS = {
  en: ['What happened', 'Why', 'What to do next', 'Technical details', 'No reason code was supplied for this candidate.'],
  th: ['เกิดอะไรขึ้น', 'ทำไม', 'ควรทำอะไรต่อ', 'รายละเอียดทางเทคนิค', 'Manager_Agent ไม่ได้ส่ง reason code สำหรับ Candidate นี้'],
};

export default function HumanDecisionExplanation({ codes, language = 'th', stage = null, compact = false, testId = 'human-decision-explanation' }) {
  const [what, why, next, technical, noReason] = LABELS[language === 'en' ? 'en' : 'th'];
  const explanations = explainDecisionReasons(codes, { language, stage });
  if (!explanations.length) return <span className="human-explanation-empty">{noReason}</span>;

  if (compact) {
    const primary = explanations[0];
    return (
      <div className="human-explanation-compact" data-testid={testId}>
        <strong>{primary.title}</strong><span>{primary.explanation}</span>
        <details><summary>{technical}</summary><div className="human-technical-codes">{explanations.map((item) => <code key={item.code}>{item.code}</code>)}</div></details>
      </div>
    );
  }

  return (
    <div className="human-explanation-stack" data-testid={testId}>
      {explanations.map((item, index) => (
        <article className={`human-explanation-card${item.known ? '' : ' unknown'}`} key={item.code}>
          <div className="human-explanation-heading"><span>{what}{explanations.length > 1 ? ` ${index + 1}` : ''}</span><strong>{item.title}</strong></div>
          <div className="human-explanation-copy"><div><span>{why}</span><p>{item.explanation}</p></div><div><span>{next}</span><p>{item.action}</p></div></div>
          <details className="human-technical-details"><summary>{technical}</summary><div><code>{item.code}</code><span>stage: {stage || 'unknown'}</span></div></details>
        </article>
      ))}
    </div>
  );
}

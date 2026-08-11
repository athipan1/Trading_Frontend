import { explainDecisionReasons } from './reasonExplanations.js';
import './humanDecisionExplanation.css';

const LABELS = {
  en: ['What happened', 'Why', 'Next step', 'Details', 'No reason code supplied.'],
  th: ['เกิดอะไรขึ้น', 'ทำไม', 'ควรทำอะไรต่อ', 'รายละเอียดทางเทคนิค', 'ไม่มี reason code จาก Manager_Agent'],
};

export default function HumanDecisionExplanation({ codes, language = 'th', stage = null, compact = false, testId }) {
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

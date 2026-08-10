import { ChevronDown, CircleHelp, Lightbulb, ShieldAlert } from 'lucide-react';
import { explainDecisionReasons } from './reasonExplanations.js';
import './humanDecisionExplanation.css';

function copy(language) {
  if (language === 'en') {
    return {
      what: 'What happened',
      why: 'Why',
      next: 'What to do next',
      technical: 'Technical details',
      technicalHint: 'Source reason codes from Manager_Agent',
      noReason: 'No reason code was supplied for this candidate.',
    };
  }
  return {
    what: 'เกิดอะไรขึ้น',
    why: 'ทำไม',
    next: 'ควรทำอะไรต่อ',
    technical: 'รายละเอียดทางเทคนิค',
    technicalHint: 'Reason code ต้นทางจาก Manager_Agent',
    noReason: 'Manager_Agent ไม่ได้ส่ง reason code สำหรับ Candidate นี้',
  };
}

export default function HumanDecisionExplanation({
  codes,
  language = 'th',
  stage = null,
  compact = false,
  testId = 'human-decision-explanation',
}) {
  const labels = copy(language);
  const explanations = explainDecisionReasons(codes, { language, stage });

  if (!explanations.length) {
    return <span className="human-explanation-empty">{labels.noReason}</span>;
  }

  if (compact) {
    const primary = explanations[0];
    return (
      <div className="human-explanation-compact" data-testid={testId}>
        <strong>{primary.title}</strong>
        <span>{primary.explanation}</span>
        <details>
          <summary>{labels.technical}<ChevronDown aria-hidden="true" /></summary>
          <div className="human-technical-codes">
            <span>{labels.technicalHint}</span>
            {explanations.map((item) => <code key={item.code}>{item.code}</code>)}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="human-explanation-stack" data-testid={testId}>
      {explanations.map((item, index) => (
        <article className={`human-explanation-card${item.known ? '' : ' unknown'}`} key={item.code}>
          <div className="human-explanation-heading">
            {item.known ? <ShieldAlert aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
            <div>
              <span>{labels.what}{explanations.length > 1 ? ` ${index + 1}` : ''}</span>
              <strong>{item.title}</strong>
            </div>
          </div>
          <div className="human-explanation-copy">
            <div>
              <span>{labels.why}</span>
              <p>{item.explanation}</p>
            </div>
            <div>
              <span><Lightbulb aria-hidden="true" /> {labels.next}</span>
              <p>{item.action}</p>
            </div>
          </div>
          <details className="human-technical-details">
            <summary>{labels.technical}<ChevronDown aria-hidden="true" /></summary>
            <div>
              <span>{labels.technicalHint}</span>
              <code>{item.code}</code>
              <span>stage: {stage || 'unknown'}</span>
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}

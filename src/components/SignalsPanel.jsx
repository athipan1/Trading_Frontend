import { RadioTower } from 'lucide-react';
import { formatPercent } from '../utils/formatters';
import EmptyState from './EmptyState.jsx';

export default function SignalsPanel({ signals, t }) {
  return (
    <section className="panel signals-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.advisoryLayer}</p>
          <h2>{t.curatorSignals}</h2>
        </div>
        <span className="pill">{t.readOnly}</span>
      </div>

      {signals.length === 0 ? (
        <EmptyState
          icon={RadioTower}
          title={t.noSignalsTitle}
          description={t.noSignalsDescription}
          testId="signals-empty-state"
        />
      ) : (
        <div className="signals-list">
          {signals.map((signal) => (
            <article className="signal-card" key={`${signal.symbol}-${signal.skill}`}>
              <div>
                <strong>{signal.symbol}</strong>
                <p>{signal.skill}</p>
              </div>
              <div>
                <span className="status good">{signal.status}</span>
                <small>{signal.signal}</small>
                <b>{formatPercent(signal.confidence)}</b>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

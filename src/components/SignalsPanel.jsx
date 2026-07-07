import { formatPercent } from '../utils/formatters';

export default function SignalsPanel({ signals }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Advisory Layer</p>
          <h2>Curator Signals</h2>
        </div>
        <span className="pill">Read-only</span>
      </div>
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
    </section>
  );
}

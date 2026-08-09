import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './language.css';
import './control-center.css';
import './persistence.css';
import './hourlyAutomation.css';
import './responsiveFixes.css';
import './navigation.css';
import './portfolio.css';
import './features/portfolio/portfolioWorkspace.css';
import './features/orders/ordersWorkspace.css';
import './features/agents/agentMonitor.css';
import './features/risk/riskDashboard.css';
import './features/backtest/backtest.css';
import './features/settings/settings.css';
import './features/observability/observability.css';
import './accessibility.css';

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="configuration-error" role="alert">
          <h1>Dashboard configuration failed</h1>
          <p>{this.state.error.message}</p>
          <p>Check VITE_DATA_SOURCE and the URL required by that mode, then rebuild the frontend.</p>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DashboardErrorBoundary>
      <App />
    </DashboardErrorBoundary>
  </React.StrictMode>,
);

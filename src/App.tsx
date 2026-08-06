import './App.css'
import AgentReport from './pages/AgentReport'
import CampaignDashboard from './pages/CampaignDashboard'
import MissedCalls from './pages/MissedCalls'
import HomeDashboard from './pages/HomeDashboard'
import FinanceReport from './pages/FinanceReport'
import CampaignPinLock from './components/CampaignPinLock'

type AppRoute = {
  path: string
  label: string
}

const routes: AppRoute[] = [
  { path: '/', label: 'Home' },
  { path: '/campaign', label: 'Campaign' },
  { path: '/finance-report', label: 'Finance Report' },
  { path: '/missed-calls', label: 'Missed Calls' },
  { path: '/agent-report', label: 'Agent Report' },
]

function getActiveRoute() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'

  if (routes.some((route) => route.path === pathname)) {
    return pathname
  }

  return '/'
}

function App() {
  const activeRoute = getActiveRoute()

  return (
    <>
      <nav className="dashboard-nav" aria-label="Dashboard sections">
        <div className="dashboard-nav-inner">
          <a className="dashboard-nav-brand" href="/">
            <img src="/logo1.png" alt="" />
            <span>Dharma Dashboard</span>
          </a>
          <div className="dashboard-nav-links">
            {routes.map((route) => (
              <a
                aria-current={activeRoute === route.path ? 'page' : undefined}
                className="dashboard-nav-link"
                href={route.path}
                key={route.path}
              >
                {route.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {activeRoute === '/' ? (
        <HomeDashboard />
      ) : activeRoute === '/missed-calls' ? (
        <MissedCalls />
      ) : activeRoute === '/agent-report' ? (
        <AgentReport />
      ) : activeRoute === '/finance-report' ? (
        <CampaignPinLock>
          <FinanceReport />
        </CampaignPinLock>
      ) : (
        <CampaignPinLock>
          <CampaignDashboard />
        </CampaignPinLock>
      )}
    </>
  )
}

export default App

import { memo } from 'react';
import { useAuth } from '../hooks/useAuth';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'users', icon: '👥', label: 'Users Table' },
  { id: 'analytics', icon: '📈', label: 'Analytics' },
];

function Sidebar({ activeTab, onTabChange, isSyncing, lastSynced, triggerSync, isOpen, onClose }) {
  const { signOut } = useAuth();

  const formatLastSynced = (dateStr) => {
    if (!dateStr) return 'Never synced';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown';
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>MedDigi-G</h2>
          <p className="sidebar-subtitle">Admin Console</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                onTabChange(item.id);
                if (onClose) onClose();
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sync-status">
            <div className="sync-indicator">
              <span className={`sync-dot ${isSyncing ? 'syncing' : ''}`} />
              <span>{isSyncing ? 'Syncing…' : `Synced ${formatLastSynced(lastSynced)}`}</span>
            </div>
          </div>

          <button
            id="sync-btn"
            className="sync-btn"
            onClick={triggerSync}
            disabled={isSyncing}
          >
            <span className={isSyncing ? 'spin' : ''}>🔄</span>
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>

          <button
            id="signout-btn"
            className="signout-btn"
            onClick={handleSignOut}
          >
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export default memo(Sidebar);

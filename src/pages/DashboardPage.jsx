import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useDeltaSync } from '../hooks/useDeltaSync';
import { useDebounce } from '../hooks/useDebounce';
import Sidebar from '../components/Sidebar';
import MetricCards from '../components/MetricCards';
import DateRangePicker from '../components/DateRangePicker';
import SearchBar from '../components/SearchBar';
import UsersTable from '../components/UsersTable';
import UserDetailDrawer from '../components/UserDetailDrawer';

// Lazy-load chart components for code splitting
const SignupVelocityChart = lazy(() => import('../components/charts/SignupVelocityChart'));
const GeographicalChart = lazy(() => import('../components/charts/GeographicalChart'));
const RoleDistributionChart = lazy(() => import('../components/charts/RoleDistributionChart'));
const PharmacyChart = lazy(() => import('../components/charts/PharmacyChart'));

function ChartLoadingFallback() {
  return (
    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
    </div>
  );
}

export default function DashboardPage() {
  const { users, isLoading, isSyncing, lastSynced, error, triggerSync } = useDeltaSync();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedUser, setSelectedUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fuzzy search using Fuse.js — lazy loaded
  const [fuseInstance, setFuseInstance] = useState(null);

  // Load Fuse.js lazily when first search happens
  useMemo(() => {
    if (debouncedSearch && users.length > 0 && !fuseInstance) {
      import('fuse.js').then((mod) => {
        const Fuse = mod.default;
        setFuseInstance(
          new Fuse(users, {
            keys: ['email', 'full_name'],
            threshold: 0.3,
            ignoreLocation: true,
          })
        );
      });
    }
  }, [debouncedSearch, users, fuseInstance]);

  // Update Fuse instance when users change
  useMemo(() => {
    if (fuseInstance && users.length > 0) {
      fuseInstance.setCollection(users);
    }
  }, [fuseInstance, users]);

  // Filtered users: search → date range
  const filteredUsers = useMemo(() => {
    let result = users;

    // Search filter
    if (debouncedSearch && fuseInstance) {
      result = fuseInstance.search(debouncedSearch).map((r) => r.item);
    }

    // Date range filter on created_at
    if (dateRange && dateRange.from) {
      const from = new Date(dateRange.from);
      const to = dateRange.to ? new Date(dateRange.to) : new Date();
      to.setHours(23, 59, 59, 999);
      result = result.filter((u) => {
        if (!u.created_at) return false;
        const d = new Date(u.created_at);
        return d >= from && d <= to;
      });
    }

    return result;
  }, [users, debouncedSearch, fuseInstance, dateRange]);

  const handleUserClick = useCallback((user) => {
    setSelectedUser(user);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedUser(null);
  }, []);

  // Full-page loading state
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">Loading user data…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Mobile Top Bar */}
      <header className="mobile-top-bar">
        <button
          className="mobile-menu-btn-bar"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="mobile-logo-text">MedDigi-G</span>
        <div style={{ width: 40 }} />
      </header>

      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSyncing={isSyncing}
        lastSynced={lastSynced}
        triggerSync={triggerSync}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content">
        {/* Error banner */}
        {error && !dismissedError && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button className="dismiss-btn" onClick={() => setDismissedError(true)} aria-label="Dismiss error">
              ✕
            </button>
          </div>
        )}

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1>
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'users' && 'Users Directory'}
              {activeTab === 'analytics' && 'Analytics'}
            </h1>
            <p className="header-subtitle">
              {activeTab === 'dashboard' && 'Real-time overview of platform activity'}
              {activeTab === 'users' && 'Browse and search all registered users'}
              {activeTab === 'analytics' && 'Detailed signup and geographic analysis'}
            </p>
          </div>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {/* ========== DASHBOARD TAB ========== */}
        {activeTab === 'dashboard' && (
          <>
            <MetricCards users={users} dateRange={dateRange} />

            <div className="controls-bar">
              <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            </div>

            {/* Charts row */}
            <div className="section-grid">
              <div className="section-card glass-card">
                <h3 className="section-title">
                  <span className="section-icon">📈</span>
                  Signup Velocity
                </h3>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <SignupVelocityChart users={users} dateRange={dateRange} />
                </Suspense>
              </div>

              <div className="section-card glass-card">
                <h3 className="section-title">
                  <span className="section-icon">🎯</span>
                  Role Distribution
                </h3>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <RoleDistributionChart users={filteredUsers} />
                </Suspense>
              </div>
            </div>

            {/* Users table */}
            <UsersTable users={filteredUsers} onUserClick={handleUserClick} />
          </>
        )}

        {/* ========== USERS TAB ========== */}
        {activeTab === 'users' && (
          <>
            <MetricCards users={users} dateRange={dateRange} />

            <div className="controls-bar">
              <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            </div>

            <UsersTable users={filteredUsers} onUserClick={handleUserClick} />
          </>
        )}

        {/* ========== ANALYTICS TAB ========== */}
        {activeTab === 'analytics' && (
          <>
            <MetricCards users={users} dateRange={dateRange} />

            <div className="section-grid">
              <div className="section-card glass-card full-width">
                <h3 className="section-title">
                  <span className="section-icon">📈</span>
                  Signup Velocity
                </h3>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <SignupVelocityChart users={users} dateRange={dateRange} />
                </Suspense>
              </div>

              <div className="section-card glass-card">
                <h3 className="section-title">
                  <span className="section-icon">🏥</span>
                  Pharmacy Distribution & Leaderboard
                </h3>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <PharmacyChart users={filteredUsers} />
                </Suspense>
              </div>

              <div className="section-card glass-card">
                <h3 className="section-title">
                  <span className="section-icon">🗺️</span>
                  Users by State
                </h3>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <GeographicalChart users={filteredUsers} />
                </Suspense>
              </div>

              <div className="section-card glass-card">
                <h3 className="section-title">
                  <span className="section-icon">🎯</span>
                  Role Distribution
                </h3>
                <Suspense fallback={<ChartLoadingFallback />}>
                  <RoleDistributionChart users={filteredUsers} />
                </Suspense>
              </div>
            </div>
          </>
        )}
      </main>

      {/* User detail drawer */}
      {selectedUser && (
        <UserDetailDrawer user={selectedUser} onClose={handleCloseDrawer} />
      )}
    </div>
  );
}

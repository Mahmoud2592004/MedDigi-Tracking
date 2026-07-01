import { useMemo, memo } from 'react';

function MetricCards({ users, dateRange, authUserCount }) {
  const totalUsers = users.length;

  const activeUsersInRange = useMemo(() => {
    if (!dateRange || !dateRange.from) return users.length;

    const from = new Date(dateRange.from);
    const to = dateRange.to ? new Date(dateRange.to) : new Date();
    // Set 'to' to end of day
    to.setHours(23, 59, 59, 999);

    return users.filter((u) => {
      if (!u.last_activity) return false;
      const activity = new Date(u.last_activity);
      return activity >= from && activity <= to;
    }).length;
  }, [users, dateRange]);

  const uniquePharmacies = useMemo(() => {
    const pharmacies = new Set();
    for (const u of users) {
      if (u.pharmacy_name && u.pharmacy_name.trim()) {
        pharmacies.add(u.pharmacy_name.trim().toLowerCase());
      }
    }
    return pharmacies.size;
  }, [users]);

  const newUsersInRange = useMemo(() => {
    if (!dateRange || !dateRange.from) return users.length;

    const from = new Date(dateRange.from);
    const to = dateRange.to ? new Date(dateRange.to) : new Date();
    to.setHours(23, 59, 59, 999);

    return users.filter((u) => {
      if (!u.created_at) return false;
      const created = new Date(u.created_at);
      return created >= from && created <= to;
    }).length;
  }, [users, dateRange]);

  return (
    <div className="metrics-grid">
      <div className="metric-card glass-card metric-teal">
        <div className="metric-icon">👥</div>
        <div className="metric-value">{totalUsers.toLocaleString()}</div>
        <div className="metric-label">Firestore User Profiles</div>
      </div>

      <div className="metric-card glass-card metric-pink">
        <div className="metric-icon">🔑</div>
        <div className="metric-value">
          {authUserCount !== null ? authUserCount.toLocaleString() : 'N/A'}
        </div>
        <div className="metric-label">Firebase Auth Accounts</div>
      </div>

      <div className="metric-card glass-card metric-purple">
        <div className="metric-icon">⚡</div>
        <div className="metric-value">{activeUsersInRange.toLocaleString()}</div>
        <div className="metric-label">Active in Date Range</div>
      </div>

      <div className="metric-card glass-card metric-amber">
        <div className="metric-icon">🏥</div>
        <div className="metric-value">{uniquePharmacies.toLocaleString()}</div>
        <div className="metric-label">Unique Pharmacies</div>
      </div>

      <div className="metric-card glass-card metric-blue">
        <div className="metric-icon">📋</div>
        <div className="metric-value">{newUsersInRange.toLocaleString()}</div>
        <div className="metric-label">Registrations in Range</div>
      </div>
    </div>
  );
}

export default memo(MetricCards);

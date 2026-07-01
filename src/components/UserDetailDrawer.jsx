import { useEffect, useCallback, memo } from 'react';
import { format } from 'date-fns';

function UserDetailDrawer({ user, onClose }) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while drawer is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  if (!user) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return '—';
    }
  };

  const formatLocation = (loc) => {
    if (!loc) return '—';
    if (typeof loc === 'string') return loc || '—';
    // Handle Firestore GeoPoint-like objects
    if (loc.latitude != null && loc.longitude != null) {
      return `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;
    }
    if (loc._lat != null && loc._long != null) {
      return `${loc._lat.toFixed(6)}, ${loc._long.toFixed(6)}`;
    }
    return JSON.stringify(loc);
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="User details">
        <div className="drawer-header">
          <h2>User Details</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Close drawer">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {/* Identity */}
          <div className="detail-group">
            <div className="detail-group-title">Identity</div>
            <div className="detail-row">
              <span className="detail-label">Full Name</span>
              <span className="detail-value">{user.full_name || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{user.email || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Phone</span>
              <span className="detail-value">{user.phone_number || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Role</span>
              <span className="detail-value">{user.role || '—'}</span>
            </div>
          </div>

          {/* Workplace */}
          <div className="detail-group">
            <div className="detail-group-title">Workplace</div>
            <div className="detail-row">
              <span className="detail-label">Pharmacy</span>
              <span className="detail-value">{user.pharmacy_name || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">State</span>
              <span className="detail-value">{user.state || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Location</span>
              <span className="detail-value location-text">{formatLocation(user.location)}</span>
            </div>
          </div>

          {/* Activity */}
          <div className="detail-group">
            <div className="detail-group-title">Activity</div>
            <div className="detail-row">
              <span className="detail-label">Registered</span>
              <span className="detail-value">{formatDate(user.created_at)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Last Activity</span>
              <span className="detail-value">{formatDate(user.last_activity)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className="detail-value">{user.status || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Level</span>
              <span className="detail-value">{user.level || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Terms Accepted</span>
              <span className="detail-value">{user.terms_of_use_accepted ? '✅ Yes' : '❌ No'}</span>
            </div>
          </div>

          {/* Solved Cases */}
          <div className="detail-group">
            <div className="detail-group-title">Solved Cases</div>
            <div className="stats-grid">
              <div className="stat-mini-card">
                <div className="stat-mini-value">{user.solved_otc ?? 0}</div>
                <div className="stat-mini-label">OTC</div>
              </div>
              <div className="stat-mini-card">
                <div className="stat-mini-value">{user.solved_hair ?? 0}</div>
                <div className="stat-mini-label">Hair</div>
              </div>
              <div className="stat-mini-card">
                <div className="stat-mini-value">{user.solved_skin ?? 0}</div>
                <div className="stat-mini-label">Skin</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(UserDetailDrawer);

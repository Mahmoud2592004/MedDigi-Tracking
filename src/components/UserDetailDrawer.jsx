import { useState, useEffect, useCallback, memo } from 'react';
import { format } from 'date-fns';

function UserDetailDrawer({ user, onClose }) {
  const [resolvedState, setResolvedState] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  // Helper to extract coordinates from location string/object
  const getCoordinates = useCallback((loc) => {
    if (!loc) return null;
    if (typeof loc === 'object' && loc.latitude != null && loc.longitude != null) {
      return { lat: loc.latitude, lng: loc.longitude };
    }
    if (typeof loc === 'string') {
      const coordsRegex = /[\[\(](-?\d+\.\d+),\s*(-?\d+\.\d+)[\]\)]/;
      const match = loc.match(coordsRegex);
      if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
      }
    }
    return null;
  }, []);

  // Resolve state dynamically using OSM Nominatim
  useEffect(() => {
    // If the database already has a resolved updated_state, use it and skip API request!
    if (user?.updated_state) {
      setResolvedState(user.updated_state);
      setIsResolving(false);
      return;
    }

    const coords = getCoordinates(user?.location);
    if (!coords) {
      setResolvedState(null);
      return;
    }

    let active = true;
    const fetchOSMState = async () => {
      setIsResolving(true);
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'MedDigi-G-Dashboard/1.0.0 (mahmoud2592004@gmail.com)'
          }
        });
        if (!res.ok) throw new Error('OSM Request failed');
        const data = await res.json();
        if (active && data && data.address) {
          const resolved = data.address.state || data.address.governorate || data.address.province || null;
          setResolvedState(resolved);
        }
      } catch (err) {
        console.error('Error resolving state via Nominatim:', err);
      } finally {
        if (active) setIsResolving(false);
      }
    };

    fetchOSMState();

    return () => {
      active = false;
    };
  }, [user, getCoordinates]);

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

  const renderLocation = (loc) => {
    if (!loc) return <span className="detail-value">—</span>;

    // Case 1: Standard GeoPoint object (e.g. { latitude, longitude })
    if (typeof loc === 'object' && loc.latitude != null && loc.longitude != null) {
      const lat = loc.latitude;
      const lng = loc.longitude;
      const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      return (
        <div style={{ textAlign: 'right' }}>
          <div className="detail-value">{coords}</div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="maps-link"
            style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'underline', display: 'block', marginTop: '2px' }}
          >
            🗺️ Open Google Maps
          </a>
        </div>
      );
    }

    // Case 2: String containing address and coordinates, e.g. "Road, City (123) [30.0, 31.0]"
    if (typeof loc === 'string') {
      const coordsRegex = /[\[\(](-?\d+\.\d+),\s*(-?\d+\.\d+)[\]\)]/;
      const match = loc.match(coordsRegex);

      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        const address = loc.replace(coordsRegex, '').replace(/,\s*$/, '').trim();

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', maxWidth: '240px', wordBreak: 'break-word', textAlign: 'right' }}>
            {address && <span className="detail-value" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{address}</span>}
            <span className="detail-value" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Coordinates: {coords}
            </span>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="maps-link"
              style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}
            >
              🗺️ Open Google Maps
            </a>
          </div>
        );
      }

      // Plain string with no coordinate match
      return <span className="detail-value">{loc}</span>;
    }

    // Fallback JSON stringify
    return <span className="detail-value">{JSON.stringify(loc)}</span>;
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span className="detail-value">{user.updated_state || user.state || '—'}</span>
                {isResolving && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Resolving correct state…
                  </span>
                )}
                {!isResolving && resolvedState && resolvedState.trim() !== (user.updated_state || user.state || '').trim() && (
                  <span 
                    title="Resolved via OpenStreetMap Nominatim"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '600' }}
                  >
                    📍 {resolvedState}
                  </span>
                )}
              </div>
            </div>
            <div className="detail-row" style={{ alignItems: 'flex-start' }}>
              <span className="detail-label" style={{ paddingTop: '2px' }}>Location</span>
              {renderLocation(user.location)}
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

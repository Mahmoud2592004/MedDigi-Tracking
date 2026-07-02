import { useRef, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';

function UsersTable({ users, onUserClick }) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return '—';
    }
  }, []);

  if (users.length === 0) {
    return (
      <div className="section-card glass-card full-width">
        <h3 className="section-title">
          <span className="section-icon">👥</span>
          Users
        </h3>
        <div className="table-container">
          <div className="table-empty">
            <span className="empty-icon">📭</span>
            <p>No users found matching your criteria</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card glass-card full-width">
      <h3 className="section-title">
        <span className="section-icon">👥</span>
        Users
      </h3>
      <div className="table-container">
        <div className="table-header-row">
          <div className="table-header-cell">Email</div>
          <div className="table-header-cell">Full Name</div>
          <div className="table-header-cell">Role</div>
          <div className="table-header-cell">State</div>
          <div className="table-header-cell">Action</div>
        </div>

        <div
          ref={parentRef}
          className="table-body"
          style={{ height: Math.min(users.length * 48, 480), overflow: 'auto' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const user = users[virtualRow.index];
              return (
                <div
                  key={user.id}
                  className="table-row"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onUserClick(user)}
                >
                  <div className="table-cell email">{user.email}</div>
                  <div className="table-cell">{user.full_name || '—'}</div>
                  <div className="table-cell">
                    <span className="role-badge">{user.role || '—'}</span>
                  </div>
                  <div className="table-cell">{user.updated_state || user.state || '—'}</div>
                  <div className="table-cell">
                    <button
                      className="view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUserClick(user);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="table-count">
          Showing {users.length.toLocaleString()} user{users.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

export default memo(UsersTable);

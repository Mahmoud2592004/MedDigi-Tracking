import { Navigate } from 'react-router-dom';

/**
 * Wraps dashboard routes. If there is no authenticated user,
 * redirects to /login. Otherwise renders children.
 */
export default function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

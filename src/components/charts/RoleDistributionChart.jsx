import { useMemo, memo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#00d4aa', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#10b981'];

function RoleDistributionChart({ users }) {
  const chartData = useMemo(() => {
    if (users.length === 0) return [];

    const roleMap = new Map();
    for (const u of users) {
      const role = (u.role || 'Unknown').trim();
      roleMap.set(role, (roleMap.get(role) || 0) + 1);
    }

    return Array.from(roleMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [users]);

  if (chartData.length === 0) {
    return (
      <div className="table-empty" style={{ height: 300 }}>
        <span className="empty-icon">🎯</span>
        <p>No role data available</p>
      </div>
    );
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            animationDuration={800}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#1a2332',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#f1f5f9',
              fontSize: 13,
            }}
            formatter={(value, name) => [value, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(RoleDistributionChart);

import { useMemo, memo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function GeographicalChart({ users }) {
  const chartData = useMemo(() => {
    if (users.length === 0) return [];

    const stateMap = new Map();
    for (const u of users) {
      const state = (u.updated_state || u.state || '').trim();
      if (state) {
        stateMap.set(state, (stateMap.get(state) || 0) + 1);
      }
    }

    return Array.from(stateMap.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15); // Top 15 states
  }, [users]);

  if (chartData.length === 0) {
    return (
      <div className="table-empty" style={{ height: 300 }}>
        <span className="empty-icon">🗺️</span>
        <p>No geographical data available</p>
      </div>
    );
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#64748b', fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="state"
            width={120}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            interval={0}
          />
          <Tooltip
            contentStyle={{
              background: '#1a2332',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#f1f5f9',
              fontSize: 13,
            }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value) => [value, 'Users']}
          />
          <Bar
            dataKey="count"
            fill="#06b6d4"
            radius={[0, 4, 4, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(GeographicalChart);

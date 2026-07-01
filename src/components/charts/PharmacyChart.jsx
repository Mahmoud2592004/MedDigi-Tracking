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

function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

function PharmacyChart({ users }) {
  const { chartData, listData } = useMemo(() => {
    if (users.length === 0) return { chartData: [], listData: [] };

    // Group by case-insensitive pharmacy name
    const pharmacyMap = new Map();
    for (const u of users) {
      const rawPharmacy = (u.pharmacy_name || '').trim();
      if (rawPharmacy) {
        const formattedName = toTitleCase(rawPharmacy);
        pharmacyMap.set(formattedName, (pharmacyMap.get(formattedName) || 0) + 1);
      }
    }

    const sortedList = Array.from(pharmacyMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Top 10 for the chart
    const topChart = sortedList.slice(0, 10);

    return {
      chartData: topChart,
      listData: sortedList,
    };
  }, [users]);

  if (chartData.length === 0) {
    return (
      <div className="table-empty" style={{ height: 300 }}>
        <span className="empty-icon">🏥</span>
        <p>No pharmacy data available</p>
      </div>
    );
  }

  // Get max count for the percentage bars in the scrollable list
  const maxCount = listData.length > 0 ? listData[0].count : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Chart */}
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#64748b', fontSize: 11 }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
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
              fill="#8b5cf6"
              radius={[0, 4, 4, 0]}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scrollable List Breakdown */}
      <div style={{ marginTop: '10px' }}>
        <h4 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
          All Pharmacies Breakdown ({listData.length})
        </h4>
        <div className="breakdown-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {listData.map((item, idx) => {
            const widthPct = (item.count / maxCount) * 100;
            return (
              <div key={item.name} className="breakdown-item">
                <div className="breakdown-label" style={{ fontWeight: idx < 3 ? '500' : '400' }}>
                  {idx + 1}. {item.name}
                </div>
                <div className="breakdown-bar">
                  <div
                    className="breakdown-bar-fill"
                    style={{
                      width: `${widthPct}%`,
                      background: 'linear-gradient(90deg, #8b5cf6, #ec4899)'
                    }}
                  />
                </div>
                <div className="breakdown-count">
                  {item.count} user{item.count !== 1 ? 's' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(PharmacyChart);

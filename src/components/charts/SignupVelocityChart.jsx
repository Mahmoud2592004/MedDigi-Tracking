import { useMemo, memo } from 'react';
import { format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function SignupVelocityChart({ users, dateRange }) {
  const chartData = useMemo(() => {
    if (users.length === 0) return [];

    // Filter users by date range if provided
    let filtered = users;
    if (dateRange && dateRange.from) {
      const from = new Date(dateRange.from);
      const to = dateRange.to ? new Date(dateRange.to) : new Date();
      to.setHours(23, 59, 59, 999);
      filtered = users.filter((u) => {
        if (!u.created_at) return false;
        const d = new Date(u.created_at);
        return d >= from && d <= to;
      });
    }

    if (filtered.length === 0) return [];

    // Group by day
    const countMap = new Map();
    for (const u of filtered) {
      if (!u.created_at) continue;
      const dayKey = format(startOfDay(new Date(u.created_at)), 'yyyy-MM-dd');
      countMap.set(dayKey, (countMap.get(dayKey) || 0) + 1);
    }

    // Build continuous range of days
    const sortedDates = Array.from(countMap.keys()).sort();
    if (sortedDates.length === 0) return [];

    const rangeStart = dateRange?.from ? startOfDay(new Date(dateRange.from)) : parseISO(sortedDates[0]);
    const rangeEnd = dateRange?.to ? startOfDay(new Date(dateRange.to)) : parseISO(sortedDates[sortedDates.length - 1]);

    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MMM d'),
        fullDate: key,
        count: countMap.get(key) || 0,
      };
    });
  }, [users, dateRange]);

  if (chartData.length === 0) {
    return (
      <div className="table-empty" style={{ height: 300 }}>
        <span className="empty-icon">📈</span>
        <p>No signup data for the selected range</p>
      </div>
    );
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            allowDecimals={false}
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
            formatter={(value) => [value, 'Signups']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#00d4aa"
            strokeWidth={2}
            fill="url(#signupGradient)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(SignupVelocityChart);

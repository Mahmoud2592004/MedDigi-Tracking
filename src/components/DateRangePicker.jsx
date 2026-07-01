import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const PRESETS = [
  { id: 'all', label: 'All Time', getRange: () => ({ from: null, to: null }) },
  { id: 'today', label: 'Today', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { id: '7d', label: 'Last 7 Days', getRange: () => ({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) }) },
  { id: '30d', label: 'Last 30 Days', getRange: () => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }) },
  { id: '90d', label: 'Last 90 Days', getRange: () => ({ from: startOfDay(subDays(new Date(), 90)), to: endOfDay(new Date()) }) },
];

function DateRangePicker({ dateRange, onDateRangeChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePreset = useCallback((preset) => {
    setActivePreset(preset.id);
    const range = preset.getRange();
    onDateRangeChange(range);
    if (preset.id !== 'custom') {
      setIsOpen(false);
    }
  }, [onDateRangeChange]);

  const handleCustomApply = useCallback(() => {
    if (customFrom && customTo) {
      setActivePreset('custom');
      onDateRangeChange({
        from: startOfDay(new Date(customFrom)),
        to: endOfDay(new Date(customTo)),
      });
      setIsOpen(false);
    }
  }, [customFrom, customTo, onDateRangeChange]);

  const getDisplayText = () => {
    if (!dateRange || !dateRange.from) return 'All Time';
    const preset = PRESETS.find((p) => p.id === activePreset);
    if (preset && activePreset !== 'all') return preset.label;
    if (activePreset === 'custom' && dateRange.from) {
      return `${format(dateRange.from, 'MMM d')} — ${format(dateRange.to || new Date(), 'MMM d, yyyy')}`;
    }
    return 'All Time';
  };

  return (
    <div className="date-picker-wrapper" ref={dropdownRef}>
      <button
        id="date-picker-trigger"
        className={`date-picker-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="calendar-icon"
          style={{ marginRight: 4, flexShrink: 0 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{getDisplayText()}</span>
        <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="date-picker-dropdown">
          <div className="date-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`date-preset-btn ${activePreset === preset.id ? 'selected' : ''}`}
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="custom-date-inputs">
            <div>
              <label htmlFor="custom-date-from">From</label>
              <input
                id="custom-date-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="custom-date-to">To</label>
              <input
                id="custom-date-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <div className="date-actions">
              <button
                className="btn btn-ghost"
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DateRangePicker);

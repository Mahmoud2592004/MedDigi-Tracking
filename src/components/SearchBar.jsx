import { memo } from 'react';

function SearchBar({ searchQuery, onSearchChange }) {
  return (
    <div className="search-wrapper">
      <span className="search-icon">🔍</span>
      <input
        id="search-input"
        className="search-input"
        type="text"
        placeholder="Search users by name or email…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}

export default memo(SearchBar);

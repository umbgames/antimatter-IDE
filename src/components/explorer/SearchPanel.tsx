import React, { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { searchWorkspace, openFileAsTab } from '@/lib/tauri';
import type { SearchResult } from '@antimatter/shared';

export function SearchPanel() {
  const { workspacePath, openFile } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspacePath || !query.trim()) return;

    setIsSearching(true);
    try {
      const searchResults = await searchWorkspace(workspacePath, query);
      setResults(searchResults);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    const file = await openFileAsTab(result.filePath);
    openFile(file);
    // TODO: scrollTo line result.line
  };

  return (
    <aside className="panel search-panel">
      <div className="panel__header">
        <h3>Search</h3>
        <p>Search text across workspace files.</p>
      </div>
      
      <form className="search-box" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          autoFocus
        />
        {isSearching && <div className="spinner-tiny" />}
      </form>

      <div className="search-results">
        {!workspacePath ? (
          <div className="empty-state compact">Open a workspace to search.</div>
        ) : results.length === 0 ? (
          <div className="empty-state compact">
            {query ? 'No results found.' : 'Enter a query to start searching.'}
          </div>
        ) : (
          results.map((result, idx) => (
            <button
              key={`${result.filePath}-${result.line}-${idx}`}
              className="search-result-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="search-result-header">
                <strong>{result.filePath.split(/[\\/]/).pop()}</strong>
                <span>Line {result.line}</span>
              </div>
              <div className="search-result-preview">
                {result.preview}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

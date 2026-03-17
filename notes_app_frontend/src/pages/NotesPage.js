import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotesStore } from '../hooks/useNotesStore';
import { makePreview, normalizeTags } from '../utils/noteUtils';

/**
 * PUBLIC_INTERFACE
 * NotesPage is the main screen for the app:
 * - sidebar: search + tags + note list
 * - main: note editor (title/content/tags + pin/favorite)
 * - local persistence via localStorage
 * - optional export/import JSON
 */
export default function NotesPage() {
  const { state, dispatch, selectedNote, allTags, filteredNotes } = useNotesStore();

  const [theme, setTheme] = useState(() => {
    const saved = window.localStorage.getItem('notemaster.theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Local editor state (controlled inputs) with "autosave" into store on debounce.
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTagsRaw, setDraftTagsRaw] = useState('');

  const saveTimerRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    // Theme application without direct DOM manipulation beyond attribute.
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('notemaster.theme', theme);
  }, [theme]);

  // When selection changes, load editor draft.
  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle('');
      setDraftContent('');
      setDraftTagsRaw('');
      return;
    }
    setDraftTitle(selectedNote.title);
    setDraftContent(selectedNote.content);
    setDraftTagsRaw(selectedNote.tags.join(', '));
  }, [selectedNote?.id]); // intentionally only reload on id change

  // Autosave: whenever draft changes, persist to selected note after a short debounce.
  useEffect(() => {
    if (!selectedNote) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      dispatch({
        type: 'UPDATE_NOTE',
        id: selectedNote.id,
        patch: {
          title: draftTitle,
          content: draftContent,
          tags: normalizeTags(draftTagsRaw)
        }
      });
    }, 250);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [dispatch, draftContent, draftTagsRaw, draftTitle, selectedNote]);

  const hasNotes = state.notes.length > 0;

  const selectedBadges = useMemo(() => {
    if (!selectedNote) return [];
    const b = [];
    if (selectedNote.pinned) b.push({ text: 'PINNED', kind: 'pin' });
    if (selectedNote.favorite) b.push({ text: 'FAV', kind: 'fav' });
    return b;
  }, [selectedNote]);

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return '';
    }
  }

  // PUBLIC_INTERFACE
  const handleNewNote = () => {
    dispatch({ type: 'NEW_NOTE', seed: { title: 'Untitled', content: '', tags: [] } });
  };

  // PUBLIC_INTERFACE
  const handleExport = () => {
    const payload = {
      exportedAt: Date.now(),
      app: 'Notemaster',
      notes: state.notes
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `notemaster-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // PUBLIC_INTERFACE
  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const notes = Array.isArray(parsed.notes) ? parsed.notes : Array.isArray(parsed) ? parsed : [];
        dispatch({ type: 'IMPORT_NOTES', notes });
      } catch {
        // Keep UX simple: ignore invalid import.
        // (Could be enhanced with toast UI later.)
      }
    };
    reader.readAsText(file);

    // reset input so user can import same file again
    e.target.value = '';
  }

  return (
    <div className="App">
      <div className="nm-shell">
        <header className="nm-topbar" role="banner">
          <div className="nm-brand">
            <div className="nm-title">Notemaster</div>
            <div className="nm-subtitle">local-only • autosave • retro UI</div>
          </div>

          <div className="nm-actions">
            <span className="nm-pill" aria-label="storage type">
              STORAGE: localStorage
            </span>

            <button className="nm-btn nm-btnPrimary" onClick={handleNewNote}>
              + New note
            </button>

            <button
              className="nm-btn"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              Theme: {theme === 'light' ? 'Light' : 'Dark'}
            </button>

            <button className="nm-btn" onClick={handleExport} disabled={!hasNotes} aria-disabled={!hasNotes}>
              Export JSON
            </button>

            <button className="nm-btn" onClick={handleImportClick}>
              Import JSON
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </div>
        </header>

        <main className="nm-layout" role="main">
          {/* Sidebar */}
          <section className="nm-panel" aria-label="Notes list and filters">
            <div className="nm-panelHeader">
              <div className="nm-panelTitle">Vault</div>
              <div className="nm-kbdHint">Search, tags, pins</div>
            </div>

            <div className="nm-panelBody">
              <div className="nm-row">
                <input
                  className="nm-input"
                  placeholder="Search title, text, tags…"
                  value={state.filter.query}
                  onChange={(e) => dispatch({ type: 'SET_QUERY', query: e.target.value })}
                  aria-label="Search notes"
                />
                <button className="nm-btn" onClick={() => dispatch({ type: 'TOGGLE_FAVORITES_ONLY' })}>
                  {state.filter.showOnlyFavorites ? '★ Only' : '★ All'}
                </button>
              </div>

              <div className="nm-divider" />

              <div className="nm-panelTitle" style={{ fontSize: 12, marginBottom: 8 }}>
                Tags
              </div>

              <div className="nm-tagsList" aria-label="Tag filters">
                <button
                  className={`nm-tagBtn ${state.filter.tag === null ? 'nm-tagBtnActive' : ''}`}
                  onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag: null })}
                >
                  all
                </button>
                {allTags.map((t) => (
                  <button
                    key={t}
                    className={`nm-tagBtn ${state.filter.tag === t ? 'nm-tagBtnActive' : ''}`}
                    onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag: t })}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="nm-divider" />

              <div className="nm-list" aria-label="Notes">
                {filteredNotes.length === 0 ? (
                  <div className="nm-empty">
                    No notes match your filters.
                    <div style={{ marginTop: 8 }}>Tip: Try clearing the tag or search query.</div>
                  </div>
                ) : (
                  filteredNotes.map((n) => {
                    const isActive = n.id === state.selectedId;
                    return (
                      <div
                        key={n.id}
                        className={`nm-noteCard ${isActive ? 'nm-noteCardActive' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => dispatch({ type: 'SELECT_NOTE', id: n.id })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') dispatch({ type: 'SELECT_NOTE', id: n.id });
                        }}
                        aria-label={`Open note ${n.title || 'Untitled'}`}
                      >
                        <div className="nm-noteTitleRow">
                          <div className="nm-noteTitle">{n.title || 'Untitled'}</div>
                          <div className="nm-noteMeta">{formatTime(n.updatedAt)}</div>
                        </div>

                        <div className="nm-notePreview">{makePreview(n.content)}</div>

                        <div className="nm-badges" aria-label="Note flags and tags">
                          {n.pinned && <span className="nm-badge nm-badgePin">PIN</span>}
                          {n.favorite && <span className="nm-badge nm-badgeFav">FAV</span>}
                          {n.tags.slice(0, 3).map((t) => (
                            <span key={t} className="nm-badge">
                              {t}
                            </span>
                          ))}
                          {n.tags.length > 3 && <span className="nm-badge">+{n.tags.length - 3}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Editor */}
          <section className="nm-panel" aria-label="Note editor">
            <div className="nm-panelHeader">
              <div className="nm-panelTitle">Editor</div>
              <div className="nm-kbdHint">Autosaves as you type</div>
            </div>

            <div className="nm-panelBody">
              {!selectedNote ? (
                <div className="nm-empty">
                  No note selected.
                  <div style={{ marginTop: 8 }}>
                    Create one with <strong>+ New note</strong>.
                  </div>
                </div>
              ) : (
                <>
                  <div className="nm-row" style={{ marginBottom: 10 }}>
                    <div className="nm-spacer">
                      <input
                        className="nm-input"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="Title…"
                        aria-label="Note title"
                      />
                    </div>

                    <button
                      className="nm-btn"
                      onClick={() => dispatch({ type: 'TOGGLE_PIN', id: selectedNote.id })}
                      aria-label={selectedNote.pinned ? 'Unpin note' : 'Pin note'}
                    >
                      {selectedNote.pinned ? 'Unpin' : 'Pin'}
                    </button>

                    <button
                      className="nm-btn"
                      onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', id: selectedNote.id })}
                      aria-label={selectedNote.favorite ? 'Remove favorite' : 'Favorite note'}
                    >
                      {selectedNote.favorite ? '★ Fav' : '☆ Fav'}
                    </button>
                  </div>

                  <div className="nm-row" style={{ marginBottom: 10 }}>
                    <div className="nm-spacer">
                      <input
                        className="nm-input"
                        value={draftTagsRaw}
                        onChange={(e) => setDraftTagsRaw(e.target.value)}
                        placeholder="Tags (comma-separated)…"
                        aria-label="Note tags"
                      />
                    </div>
                    <span className="nm-pill" aria-label="autosave indicator">
                      SAVED
                    </span>
                  </div>

                  <div className="nm-badges" style={{ marginBottom: 10 }} aria-label="Selected note flags">
                    {selectedBadges.length === 0 ? (
                      <span className="nm-pill">No flags</span>
                    ) : (
                      selectedBadges.map((b) => (
                        <span
                          key={b.text}
                          className={`nm-badge ${b.kind === 'pin' ? 'nm-badgePin' : 'nm-badgeFav'}`}
                        >
                          {b.text}
                        </span>
                      ))
                    )}
                  </div>

                  <textarea
                    className="nm-textarea"
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Write your note…"
                    aria-label="Note content"
                  />

                  <div className="nm-divider" />

                  <div className="nm-row">
                    <span className="nm-pill" aria-label="note info">
                      UPDATED: {formatTime(selectedNote.updatedAt)}
                    </span>
                    <span className="nm-spacer" />
                    <button
                      className="nm-btn"
                      onClick={() => dispatch({ type: 'DUPLICATE_NOTE', id: selectedNote.id })}
                    >
                      Duplicate
                    </button>
                    <button
                      className="nm-btn nm-btnDanger"
                      onClick={() => dispatch({ type: 'DELETE_NOTE', id: selectedNote.id })}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="nm-kbdHint" style={{ marginTop: 10 }}>
                    Tip: search matches title + content + tags. Tags are normalized to lowercase.
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

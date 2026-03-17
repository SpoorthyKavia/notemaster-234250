import { useEffect, useMemo, useReducer } from 'react';
import { createNote, normalizeTags } from '../utils/noteUtils';
import { useLocalStorageState } from './useLocalStorageState';

/**
 * @typedef {{id:string,title:string,content:string,tags:string[],pinned:boolean,favorite:boolean,createdAt:number,updatedAt:number}} Note
 */

/**
 * @typedef {{
 *  notes: Note[],
 *  selectedId: string | null,
 *  filter: { query: string, tag: string | null, showOnlyFavorites: boolean },
 *  ui: { isMobileListOpen: boolean }
 * }} NotesState
 */

const STORAGE_KEY = 'notemaster.notes.v1';

function sortNotes(notes) {
  // Sort pinned first, then updatedAt descending.
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
}

function notesReducer(state, action) {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, filter: { ...state.filter, query: action.query } };
    case 'SET_TAG_FILTER':
      return { ...state, filter: { ...state.filter, tag: action.tag } };
    case 'TOGGLE_FAVORITES_ONLY':
      return {
        ...state,
        filter: { ...state.filter, showOnlyFavorites: !state.filter.showOnlyFavorites }
      };
    case 'TOGGLE_MOBILE_LIST':
      return { ...state, ui: { ...state.ui, isMobileListOpen: !state.ui.isMobileListOpen } };
    case 'SELECT_NOTE':
      return { ...state, selectedId: action.id, ui: { ...state.ui, isMobileListOpen: false } };
    case 'NEW_NOTE': {
      const n = createNote(action.seed);
      const nextNotes = sortNotes([n, ...state.notes]);
      return { ...state, notes: nextNotes, selectedId: n.id, ui: { ...state.ui, isMobileListOpen: false } };
    }
    case 'DELETE_NOTE': {
      const nextNotes = state.notes.filter((n) => n.id !== action.id);
      const nextSelected =
        state.selectedId === action.id ? (nextNotes[0]?.id ?? null) : state.selectedId;
      return { ...state, notes: nextNotes, selectedId: nextSelected };
    }
    case 'DUPLICATE_NOTE': {
      const original = state.notes.find((n) => n.id === action.id);
      if (!original) return state;
      const copy = createNote({
        title: original.title ? `${original.title} (copy)` : 'Untitled (copy)',
        content: original.content,
        tags: original.tags,
        pinned: false,
        favorite: false
      });
      const nextNotes = sortNotes([copy, ...state.notes]);
      return { ...state, notes: nextNotes, selectedId: copy.id, ui: { ...state.ui, isMobileListOpen: false } };
    }
    case 'TOGGLE_PIN': {
      const nextNotes = state.notes.map((n) =>
        n.id === action.id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
      );
      return { ...state, notes: sortNotes(nextNotes) };
    }
    case 'TOGGLE_FAVORITE': {
      const nextNotes = state.notes.map((n) =>
        n.id === action.id ? { ...n, favorite: !n.favorite, updatedAt: Date.now() } : n
      );
      return { ...state, notes: sortNotes(nextNotes) };
    }
    case 'UPDATE_NOTE': {
      const { id, patch } = action;
      const now = Date.now();
      const nextNotes = state.notes.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          ...patch,
          tags: patch.tags !== undefined ? patch.tags : n.tags,
          updatedAt: now
        };
      });
      return { ...state, notes: sortNotes(nextNotes) };
    }
    case 'IMPORT_NOTES': {
      const incoming = Array.isArray(action.notes) ? action.notes : [];
      const cleaned = incoming
        .filter((n) => n && typeof n === 'object')
        .map((n) =>
          createNote({
            id: n.id,
            title: typeof n.title === 'string' ? n.title : '',
            content: typeof n.content === 'string' ? n.content : '',
            tags: Array.isArray(n.tags) ? n.tags.map((t) => String(t).toLowerCase()) : [],
            pinned: Boolean(n.pinned),
            favorite: Boolean(n.favorite),
            createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
            updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now()
          })
        );

      const nextNotes = sortNotes(cleaned);
      return { ...state, notes: nextNotes, selectedId: nextNotes[0]?.id ?? null };
    }
    case 'MIGRATE_FROM_LEGACY_TAG_STRING': {
      // Allows converting "tagsRaw" field to tags[] in editor without persisting duplicates.
      const nextNotes = state.notes.map((n) =>
        n.id === action.id ? { ...n, tags: normalizeTags(action.raw), updatedAt: Date.now() } : n
      );
      return { ...state, notes: sortNotes(nextNotes) };
    }
    default:
      return state;
  }
}

/**
 * PUBLIC_INTERFACE
 * Provides a reducer-driven notes store with local persistence.
 */
export function useNotesStore() {
  const [persisted, setPersisted] = useLocalStorageState(
    STORAGE_KEY,
    () => ({
      notes: [],
      selectedId: null,
      filter: { query: '', tag: null, showOnlyFavorites: false },
      ui: { isMobileListOpen: false }
    }),
    { debounceMs: 200, version: 1 }
  );

  const [state, dispatch] = useReducer(notesReducer, persisted);

  // Persist reducer state to localStorage (debounced inside useLocalStorageState).
  useEffect(() => {
    setPersisted(state);
  }, [setPersisted, state]);

  const selectedNote = useMemo(
    () => state.notes.find((n) => n.id === state.selectedId) ?? null,
    [state.notes, state.selectedId]
  );

  const allTags = useMemo(() => {
    const set = new Set();
    state.notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state.notes]);

  const filteredNotes = useMemo(() => {
    const q = state.filter.query.trim().toLowerCase();
    const tag = state.filter.tag;

    return state.notes.filter((n) => {
      if (state.filter.showOnlyFavorites && !n.favorite) return false;
      if (tag && !n.tags.includes(tag)) return false;
      if (!q) return true;

      const hay = `${n.title}\n${n.content}\n${n.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [state.filter.query, state.filter.showOnlyFavorites, state.filter.tag, state.notes]);

  return {
    state,
    dispatch,
    selectedNote,
    allTags,
    filteredNotes
  };
}

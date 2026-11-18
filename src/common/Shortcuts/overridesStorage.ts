// Copyright (C) 2017-2026 Smart code 203358507

import { STORAGE_VERSION, sanitizeOverrides } from './bindings';
import { PRIMARY_MODIFIER } from './keyboard';
import shortcuts from './shortcuts.json';

const STORAGE_KEY = 'shortcutOverrides';

const loadOverrides = (): ShortcutOverrides => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return {};
        return sanitizeOverrides(JSON.parse(raw), shortcuts, PRIMARY_MODIFIER);
    } catch {
        return {};
    }
};

const saveOverrides = (overrides: ShortcutOverrides) => {
    try {
        if (Object.keys(overrides).length === 0) {
            window.localStorage.removeItem(STORAGE_KEY);
        } else {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, overrides }));
        }
    } catch {
        // Storage can be unavailable or full; the in-memory overrides still work for this session.
    }
};

export {
    STORAGE_KEY,
    loadOverrides,
    saveOverrides,
};

type Shortcut = {
    name: string,
    label: string,
    combos: string[][],
};

type ShortcutGroup = {
    name: string,
    label: string,
    shortcuts: Shortcut[],
};

// Sparse user overrides: shortcut name -> slot index -> combo.
type ShortcutOverrides = Record<string, Record<string, string[]>>;

type EffectiveShortcut = Shortcut & {
    // Per slot: true when the combo differs from the default (user override).
    overridden: boolean[],
};

type EffectiveShortcutGroup = {
    name: string,
    label: string,
    shortcuts: EffectiveShortcut[],
};

type ShortcutTarget = {
    name: string,
    slot: number,
};

type ShortcutConflict = ShortcutTarget & {
    locked: boolean,
};

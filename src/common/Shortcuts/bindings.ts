// Copyright (C) 2017-2026 Smart code 203358507

// Pure logic for user-rebindable shortcuts (#1332). Deliberately import-free so
// that tests can load it with tests/helpers/loadTs.js. Anything platform specific
// (primary modifier, key normalisation) is passed in by the caller.

type Combo = string[];
type Overrides = Record<string, Record<string, Combo>>;
type PrimaryModifier = 'Ctrl' | 'Meta';
type Target = { name: string, slot: number };
type Conflict = { name: string, slot: number, locked: boolean };
type KeyEventLike = {
    ctrlKey: boolean,
    shiftKey: boolean,
    altKey: boolean,
    metaKey: boolean,
    altGraph?: boolean,
};
type ComboError = { error: 'modifier-only' | 'alt' | 'reserved' | 'unsupported' };
type BindingGroup = {
    name: string,
    label: string,
    shortcuts: { name: string, label: string, combos: Combo[] }[],
};

const STORAGE_VERSION = 1;

// Shortcuts that cannot be rebound yet. Pass 2 = delete an entry after the
// matching refactor (see SPEC §3 / §12).
const LOCKED_SHORTCUTS: Record<string, string> = {
    interfaceScale: 'Zoom aliases and Shift tolerance live in the matcher; the only shortcut active inside inputs',
    navigateTabs: 'App.js uses the pressed digit as a tab index and gamepad navigation dispatches Digit1-6',
    playPause: 'Handled by hard-coded keydown/keyup in Player.js (hold Space for speed)',
    seekForward: 'Key release (releaseKeyboardSeek) is a hard-coded ArrowLeft/ArrowRight keyup in Player.js',
    seekBackward: 'Key release (releaseKeyboardSeek) is a hard-coded ArrowLeft/ArrowRight keyup in Player.js',
    statisticsMenu: 'Hold release is a hard-coded D keyup in Player.js',
    exit: 'Escape is also hard-coded in FullscreenProvider and the modals',
    subtitlesDelay: 'Keyup release in useSubtitles.ts only works for letter keys',
};

// Browser / OS actions a page cannot reliably block, plus keys the app or
// accessibility depends on outside the shortcut system. Written with `Mod`.
const RESERVED_COMBOS: Combo[] = [
    ['Mod', 'W'], ['Mod', 'T'], ['Mod', 'N'], ['Mod', 'Q'], ['Mod', 'R'], ['Mod', 'L'], ['Mod', 'Tab'],
    ['Mod', 'Shift', 'T'], ['Mod', 'Shift', 'N'], ['Mod', 'Shift', 'W'], ['Mod', 'Shift', 'I'], ['Mod', 'Shift', 'J'],
    ['F5'], ['F11'], ['F12'],
    ['Tab'], ['Shift', 'Tab'], ['Enter'],
    ['Escape'],
];

const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'AltGraph', 'Meta', 'OS', 'Super', 'Hyper'];
const NAMED_KEYS = [
    'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Insert',
];
const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;
const ZOOM_KEY_ALIASES: Record<string, string[]> = { '+': ['='] };

const isModifierName = (key: string) => key === 'Ctrl' || key === 'Mod' || key === 'Shift';

const isSupportedKey = (key: string) => {
    return (key.length === 1 && key !== ' ') || NAMED_KEYS.includes(key) || FUNCTION_KEY.test(key);
};

// [Ctrl|Mod, Shift, ...keys]; null when the combo is malformed.
const canonicalizeCombo = (combo: unknown): Combo | null => {
    if (!Array.isArray(combo) || combo.length === 0 || combo.some((key) => typeof key !== 'string' || key === '')) {
        return null;
    }

    const keys = combo as string[];
    const ctrl = keys.includes('Ctrl');
    const mod = keys.includes('Mod');
    const shift = keys.includes('Shift');
    const rest = keys.filter((key) => !isModifierName(key));
    const modifierCount = keys.length - rest.length;
    const uniqueModifiers = Number(ctrl) + Number(mod) + Number(shift);

    if (ctrl && mod) return null;
    if (modifierCount !== uniqueModifiers) return null;
    if (rest.length === 0) return null;

    return [...(mod ? ['Mod'] : ctrl ? ['Ctrl'] : []), ...(shift ? ['Shift'] : []), ...rest];
};

const sameCombo = (a: Combo, b: Combo) => a.length === b.length && a.every((key, index) => key === b[index]);

const isReserved = (combo: Combo) => RESERVED_COMBOS.some((reserved) => sameCombo(reserved, combo));

const comboFromKeyEvent = (
    event: KeyEventLike,
    normalizedKey: string,
    primaryModifier: PrimaryModifier,
): Combo | ComboError => {
    if (MODIFIER_KEYS.includes(normalizedKey)) return { error: 'modifier-only' };
    if (event.altKey || event.altGraph) return { error: 'alt' };

    const primaryPressed = primaryModifier === 'Meta' ? event.metaKey : event.ctrlKey;
    const otherPressed = primaryModifier === 'Meta' ? event.ctrlKey : event.metaKey;

    // The matcher only understands the primary modifier plus, on macOS, physical Ctrl.
    if (primaryModifier === 'Meta' ? (primaryPressed && otherPressed) : otherPressed) {
        return { error: 'unsupported' };
    }

    const combo = [
        ...(primaryPressed ? ['Mod'] : otherPressed ? ['Ctrl'] : []),
        ...(event.shiftKey ? ['Shift'] : []),
        normalizedKey,
    ];

    if (isReserved(combo)) return { error: 'reserved' };
    if (!isSupportedKey(normalizedKey)) return { error: 'unsupported' };

    return combo;
};

const isLocked = (name: string) => Object.prototype.hasOwnProperty.call(LOCKED_SHORTCUTS, name);

const resolveShortcuts = (groups: BindingGroup[], overrides: Overrides) => {
    return groups.map((group) => ({
        ...group,
        shortcuts: group.shortcuts.map((shortcut) => {
            const slots = overrides[shortcut.name] ?? {};
            return {
                ...shortcut,
                combos: shortcut.combos.map((combo, index) => slots[index] ?? combo),
                overridden: shortcut.combos.map((_, index) => slots[index] !== undefined),
            };
        }),
    }));
};

// `Mod` and `Ctrl` are the same modifier when the primary modifier is Ctrl.
const modifiersOf = (combo: Combo, primaryModifier: PrimaryModifier, ignoreShift: boolean) => {
    const modifiers: string[] = [];
    if (combo.includes('Mod')) modifiers.push(primaryModifier === 'Ctrl' ? 'Ctrl' : 'Mod');
    if (combo.includes('Ctrl') && !modifiers.includes('Ctrl')) modifiers.push('Ctrl');
    if (combo.includes('Shift') && !ignoreShift) modifiers.push('Shift');
    return modifiers.sort();
};

const combosConflict = (a: Combo, b: Combo, bName: string, primaryModifier: PrimaryModifier) => {
    const zoom = bName === 'interfaceScale';
    const bKeys = b.filter((key) => !isModifierName(key));
    const bMatchKeys = zoom ? bKeys.flatMap((key) => [key, ...(ZOOM_KEY_ALIASES[key] ?? [])]) : bKeys;
    // The matcher ignores Shift for the zoom-in and reset combos.
    const ignoreShift = zoom && (bKeys.includes('+') || bKeys.includes('0'));

    const aModifiers = modifiersOf(a, primaryModifier, ignoreShift);
    const bModifiers = modifiersOf(b, primaryModifier, ignoreShift);
    if (aModifiers.join() !== bModifiers.join()) return false;

    return a.some((key) => !isModifierName(key) && bMatchKeys.includes(key));
};

const findConflict = (
    effectiveGroups: BindingGroup[],
    combo: Combo,
    target: Target | null,
    primaryModifier: PrimaryModifier,
): Conflict | null => {
    for (const group of effectiveGroups) {
        for (const shortcut of group.shortcuts) {
            for (let slot = 0; slot < shortcut.combos.length; slot++) {
                if (target && target.name === shortcut.name && target.slot === slot) continue;
                if (combosConflict(combo, shortcut.combos[slot], shortcut.name, primaryModifier)) {
                    return { name: shortcut.name, slot, locked: isLocked(shortcut.name) };
                }
            }
        }
    }

    return null;
};

const dropDefaults = (overrides: Overrides, groups: BindingGroup[], primaryModifier: PrimaryModifier) => {
    const result: Overrides = {};
    const shortcuts = groups.flatMap((group) => group.shortcuts);

    Object.keys(overrides).forEach((name) => {
        const defaults = shortcuts.find((shortcut) => shortcut.name === name)?.combos;
        const slots: Record<string, Combo> = {};
        Object.keys(overrides[name]).forEach((slot) => {
            const combo = overrides[name][slot];
            const normalized = (value: Combo) => modifiersOf(value, primaryModifier, false).join() + '|' + value.filter((key) => !isModifierName(key)).join();
            const defaultCombo = defaults?.[Number(slot)];
            if (!defaultCombo || normalized(defaultCombo) !== normalized(combo)) {
                slots[slot] = combo;
            }
        });
        if (Object.keys(slots).length > 0) result[name] = slots;
    });

    return result;
};

// Drops overridden slots that clash with another slot in the resulting state.
const dropConflicting = (overrides: Overrides, groups: BindingGroup[], primaryModifier: PrimaryModifier) => {
    let result = overrides;
    for (let changed = true; changed;) {
        changed = false;
        const effective = resolveShortcuts(groups, result);
        for (const name of Object.keys(result)) {
            for (const slotKey of Object.keys(result[name])) {
                const target = { name, slot: Number(slotKey) };
                if (findConflict(effective, result[name][slotKey], target, primaryModifier)) {
                    const { [slotKey]: _removed, ...rest } = result[name];
                    result = { ...result, [name]: rest };
                    if (Object.keys(rest).length === 0) delete result[name];
                    changed = true;
                    break;
                }
            }
            if (changed) break;
        }
    }

    return result;
};

// Returns a clean overrides object. Never throws; invalid entries are dropped.
const sanitizeOverrides = (raw: unknown, groups: BindingGroup[], primaryModifier: PrimaryModifier = 'Ctrl'): Overrides => {
    const stored = raw as { version?: unknown, overrides?: unknown } | null;
    if (!stored || typeof stored !== 'object' || stored.version !== STORAGE_VERSION) return {};
    const input = stored.overrides;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

    const shortcuts = groups.flatMap((group) => group.shortcuts);
    const defaultsOnly = resolveShortcuts(groups, {});
    const lockedGroups = defaultsOnly
        .map((group) => ({ ...group, shortcuts: group.shortcuts.filter(({ name }) => isLocked(name)) }));
    const accepted: Overrides = {};

    Object.keys(input).forEach((name) => {
        const shortcut = shortcuts.find((item) => item.name === name);
        const slots = (input as Record<string, unknown>)[name];
        if (!shortcut || isLocked(name) || !slots || typeof slots !== 'object' || Array.isArray(slots)) return;

        Object.keys(slots).forEach((slotKey) => {
            const slot = Number(slotKey);
            if (!/^\d+$/.test(slotKey) || slot >= shortcut.combos.length) return;

            const combo = canonicalizeCombo((slots as Record<string, unknown>)[slotKey]);
            if (!combo || combo.filter((key) => !isModifierName(key)).length !== 1) return;
            if (!isSupportedKey(combo[combo.length - 1]) || isReserved(combo)) return;
            if (findConflict(lockedGroups, combo, null, primaryModifier)) return;

            accepted[name] = { ...accepted[name], [slotKey]: combo };
        });
    });

    return dropConflicting(dropDefaults(accepted, groups, primaryModifier), groups, primaryModifier);
};

// Pure: returns the new overrides, or the same object when the change is refused
// (locked target, locked owner, or an unresolved conflict without `swap`).
const setBinding = (
    overrides: Overrides,
    groups: BindingGroup[],
    target: Target,
    combo: Combo,
    options: { swap?: boolean, primaryModifier?: PrimaryModifier } = {},
): Overrides => {
    const primaryModifier = options.primaryModifier ?? 'Ctrl';
    const canonical = canonicalizeCombo(combo);
    if (!canonical || isLocked(target.name) || isReserved(canonical)) return overrides;

    const effective = resolveShortcuts(groups, overrides);
    const targetShortcut = effective.flatMap((group) => group.shortcuts).find(({ name }) => name === target.name);
    if (!targetShortcut || target.slot < 0 || target.slot >= targetShortcut.combos.length) return overrides;

    const conflict = findConflict(effective, canonical, target, primaryModifier);
    if (conflict && (conflict.locked || !options.swap)) return overrides;

    const next: Overrides = {};
    Object.keys(overrides).forEach((name) => {
        next[name] = { ...overrides[name] };
    });
    const assign = (name: string, slot: number, value: Combo) => {
        next[name] = { ...next[name], [slot]: value };
    };

    if (conflict) assign(conflict.name, conflict.slot, targetShortcut.combos[target.slot]);
    assign(target.name, target.slot, canonical);

    return dropDefaults(next, groups, primaryModifier);
};

// Resetting one shortcut can bring back a default that another override took over
// (e.g. after a swap). Those dependent overrides are reset too, so the result never conflicts.
const resetShortcut = (
    overrides: Overrides,
    name: string,
    groups: BindingGroup[] = [],
    primaryModifier: PrimaryModifier = 'Ctrl',
): Overrides => {
    const { [name]: _removed, ...rest } = overrides;
    return groups.length > 0 ? dropConflicting(rest, groups, primaryModifier) : rest;
};

export {
    STORAGE_VERSION,
    LOCKED_SHORTCUTS,
    RESERVED_COMBOS,
    canonicalizeCombo,
    comboFromKeyEvent,
    isLocked,
    isReserved,
    sanitizeOverrides,
    resolveShortcuts,
    findConflict,
    setBinding,
    resetShortcut,
};

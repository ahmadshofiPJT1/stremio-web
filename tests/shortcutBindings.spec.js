// Copyright (C) 2017-2026 Smart code 203358507

const loadTs = require('./helpers/loadTs');
const defaults = require('../src/common/Shortcuts/shortcuts.json');

const {
    LOCKED_SHORTCUTS,
    canonicalizeCombo,
    comboFromKeyEvent,
    sanitizeOverrides,
    resolveShortcuts,
    findConflict,
    setBinding,
    resetShortcut,
} = loadTs('src/common/Shortcuts/bindings.ts');
const { shouldPreventDefault } = loadTs('src/common/Shortcuts/preventDefault.ts');

const flat = (groups) => groups.flatMap((group) => group.shortcuts);
const comboOf = (groups, name, slot) => flat(groups).find((shortcut) => shortcut.name === name).combos[slot];
const stripFlags = (groups) => groups.map((group) => ({
    ...group,
    shortcuts: group.shortcuts.map(({ name, label, combos }) => ({ name, label, combos })),
}));
const stored = (overrides) => ({ version: 1, overrides });
const event = (extra = {}) => ({ ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...extra });

describe('resolveShortcuts', () => {
    test('without overrides the effective groups equal the defaults', () => {
        const effective = resolveShortcuts(defaults, {});
        expect(stripFlags(effective)).toEqual(defaults);
        flat(effective).forEach(({ overridden }) => expect(overridden.every((flag) => !flag)).toBe(true));
    });

    test('an override replaces only its slot', () => {
        const effective = resolveShortcuts(defaults, { volume: { 1: ['Shift', 'ArrowDown'] } });
        expect(comboOf(effective, 'volume', 0)).toEqual(['ArrowUp']);
        expect(comboOf(effective, 'volume', 1)).toEqual(['Shift', 'ArrowDown']);
        expect(flat(effective).find(({ name }) => name === 'volume').overridden).toEqual([false, true]);
        expect(comboOf(effective, 'mute', 0)).toEqual(['M']);
    });
});

describe('sanitizeOverrides', () => {
    test('keeps valid overrides', () => {
        expect(sanitizeOverrides(stored({ mute: { 0: ['K'] } }), defaults)).toEqual({ mute: { 0: ['K'] } });
    });

    test('drops unknown names, locked names and out-of-range slots', () => {
        const raw = stored({
            nope: { 0: ['K'] },
            playPause: { 0: ['K'] },
            mute: { 1: ['K'], x: ['K'] },
        });
        expect(sanitizeOverrides(raw, defaults)).toEqual({});
    });

    test('drops malformed, reserved and locked-conflicting combos', () => {
        const raw = stored({
            mute: { 0: 'K' },
            fullscreen: { 0: ['Ctrl', 'Mod', 'K'] },
            videoScale: { 0: ['Mod', 'W'] },
            toggleSubtitles: { 0: ['Space'] },
            audioMenu: { 0: ['3'] },
            infoMenu: { 0: ['Mod', '='] },
            speedMenu: { 0: [] },
        });
        expect(sanitizeOverrides(raw, defaults)).toEqual({});
    });

    test('drops overrides equal to the default and clashing duplicates', () => {
        expect(sanitizeOverrides(stored({ mute: { 0: ['M'] } }), defaults)).toEqual({});
        const clash = sanitizeOverrides(stored({ mute: { 0: ['K'] }, audioMenu: { 0: ['K'] } }), defaults);
        expect(Object.keys(clash)).toHaveLength(1);
    });

    test('accepts a valid swap state', () => {
        const raw = stored({ mute: { 0: ['F'] }, fullscreen: { 0: ['M'] } });
        expect(sanitizeOverrides(raw, defaults)).toEqual({ mute: { 0: ['F'] }, fullscreen: { 0: ['M'] } });
    });

    test('drops everything for unknown version or junk input', () => {
        expect(sanitizeOverrides({ version: 2, overrides: { mute: { 0: ['K'] } } }, defaults)).toEqual({});
        [null, undefined, 'x', 5, [], { version: 1 }, { version: 1, overrides: [] }]
            .forEach((raw) => expect(sanitizeOverrides(raw, defaults)).toEqual({}));
    });
});

describe('comboFromKeyEvent', () => {
    test('plain key and Shift+key', () => {
        expect(comboFromKeyEvent(event(), 'K', 'Ctrl')).toEqual(['K']);
        expect(comboFromKeyEvent(event({ shiftKey: true }), 'K', 'Ctrl')).toEqual(['Shift', 'K']);
    });

    test('primary modifier becomes Mod', () => {
        expect(comboFromKeyEvent(event({ ctrlKey: true }), 'K', 'Ctrl')).toEqual(['Mod', 'K']);
        expect(comboFromKeyEvent(event({ metaKey: true, shiftKey: true }), 'K', 'Meta')).toEqual(['Mod', 'Shift', 'K']);
    });

    test('physical Ctrl on macOS stays Ctrl', () => {
        expect(comboFromKeyEvent(event({ ctrlKey: true }), 'K', 'Meta')).toEqual(['Ctrl', 'K']);
    });

    test('Alt, AltGr and modifier-only presses are errors', () => {
        expect(comboFromKeyEvent(event({ altKey: true }), 'K', 'Ctrl')).toEqual({ error: 'alt' });
        expect(comboFromKeyEvent(event({ altGraph: true }), 'K', 'Ctrl')).toEqual({ error: 'alt' });
        expect(comboFromKeyEvent(event({ ctrlKey: true }), 'Control', 'Ctrl')).toEqual({ error: 'modifier-only' });
        expect(comboFromKeyEvent(event({ shiftKey: true }), 'Shift', 'Ctrl')).toEqual({ error: 'modifier-only' });
    });

    test('reserved combos are errors', () => {
        expect(comboFromKeyEvent(event({ ctrlKey: true }), 'W', 'Ctrl')).toEqual({ error: 'reserved' });
        expect(comboFromKeyEvent(event(), 'Tab', 'Ctrl')).toEqual({ error: 'reserved' });
        expect(comboFromKeyEvent(event(), 'Escape', 'Ctrl')).toEqual({ error: 'reserved' });
        expect(comboFromKeyEvent(event(), 'F5', 'Ctrl')).toEqual({ error: 'reserved' });
    });

    test('Windows key on a non-macOS platform is unsupported', () => {
        expect(comboFromKeyEvent(event({ metaKey: true }), 'K', 'Ctrl')).toEqual({ error: 'unsupported' });
    });
});

describe('findConflict', () => {
    const effective = resolveShortcuts(defaults, {});
    const mute = { name: 'mute', slot: 0 };

    test('another editable slot', () => {
        expect(findConflict(effective, ['F'], mute, 'Ctrl')).toEqual({ name: 'fullscreen', slot: 0, locked: false });
    });

    test('locked owners', () => {
        expect(findConflict(effective, ['Space'], mute, 'Ctrl')).toMatchObject({ name: 'playPause', locked: true });
        expect(findConflict(effective, ['3'], mute, 'Ctrl')).toMatchObject({ name: 'navigateTabs', locked: true });
        expect(findConflict(effective, ['Mod', '='], mute, 'Ctrl')).toMatchObject({ name: 'interfaceScale', locked: true });
        expect(findConflict(effective, ['Mod', 'Shift', '0'], mute, 'Ctrl')).toMatchObject({ name: 'interfaceScale' });
    });

    test('the edited slot is ignored', () => {
        expect(findConflict(effective, ['M'], mute, 'Ctrl')).toBeNull();
        expect(findConflict(effective, ['K'], mute, 'Ctrl')).toBeNull();
    });

    test('Mod equals Ctrl when the primary modifier is Ctrl', () => {
        expect(findConflict(effective, ['Mod', '/'], mute, 'Ctrl')).toMatchObject({ name: 'shortcuts' });
        expect(findConflict(effective, ['Mod', '/'], mute, 'Meta')).toBeNull();
        expect(findConflict(effective, ['Ctrl', '/'], mute, 'Meta')).toMatchObject({ name: 'shortcuts' });
    });
});

describe('setBinding / resetShortcut', () => {
    test('sets a free combo', () => {
        expect(setBinding({}, defaults, { name: 'mute', slot: 0 }, ['K'])).toEqual({ mute: { 0: ['K'] } });
    });

    test('refuses conflicts without swap, and locked targets or owners', () => {
        const target = { name: 'mute', slot: 0 };
        expect(setBinding({}, defaults, target, ['F'])).toEqual({});
        expect(setBinding({}, defaults, target, ['Space'], { swap: true })).toEqual({});
        expect(setBinding({}, defaults, { name: 'playPause', slot: 0 }, ['K'])).toEqual({});
    });

    test('swap updates both slots', () => {
        expect(setBinding({}, defaults, { name: 'mute', slot: 0 }, ['F'], { swap: true }))
            .toEqual({ mute: { 0: ['F'] }, fullscreen: { 0: ['M'] } });
    });

    test('an override equal to its default is removed', () => {
        const swapped = setBinding({}, defaults, { name: 'mute', slot: 0 }, ['F'], { swap: true });
        expect(setBinding(swapped, defaults, { name: 'mute', slot: 0 }, ['M'], { swap: true })).toEqual({});
    });

    test('resetShortcut removes one shortcut, empty object resets all', () => {
        const overrides = { mute: { 0: ['K'] }, volume: { 0: ['J'] } };
        expect(resetShortcut(overrides, 'mute')).toEqual({ volume: { 0: ['J'] } });
        expect(resetShortcut({}, 'mute')).toEqual({});
    });

    test('resetting one side of a swap also resets the other side', () => {
        const swapped = setBinding({}, defaults, { name: 'mute', slot: 0 }, ['F'], { swap: true });
        expect(resetShortcut(swapped, 'mute', defaults)).toEqual({});
        expect(resetShortcut(swapped, 'fullscreen', defaults)).toEqual({});
    });
});

describe('guards', () => {
    test('every locked shortcut exists in shortcuts.json', () => {
        const names = flat(defaults).map(({ name }) => name);
        Object.keys(LOCKED_SHORTCUTS).forEach((name) => expect(names).toContain(name));
        expect(Object.keys(LOCKED_SHORTCUTS)).toHaveLength(8);
    });

    test('default bindings do not conflict with each other', () => {
        const effective = resolveShortcuts(defaults, {});
        flat(effective).forEach(({ name, combos }) => {
            combos.forEach((combo, slot) => {
                expect(findConflict(effective, combo, { name, slot }, 'Ctrl')).toBeNull();
            });
        });
    });

    test('canonicalizeCombo orders modifiers and rejects junk', () => {
        expect(canonicalizeCombo(['K', 'Shift', 'Mod'])).toEqual(['Mod', 'Shift', 'K']);
        expect(canonicalizeCombo(['Shift'])).toBeNull();
        expect(canonicalizeCombo(['Mod', 'Mod', 'K'])).toBeNull();
        expect(canonicalizeCombo('K')).toBeNull();
    });

    test('a user combo containing Mod still has its browser action blocked (#203)', () => {
        const overrides = setBinding({}, defaults, { name: 'shortcuts', slot: 0 }, ['Mod', 'Shift', 'K']);
        const keys = comboOf(resolveShortcuts(defaults, overrides), 'shortcuts', 0);
        expect(keys).toEqual(['Mod', 'Shift', 'K']);
        expect(shouldPreventDefault('shortcuts', keys)).toBe(true);
    });
});

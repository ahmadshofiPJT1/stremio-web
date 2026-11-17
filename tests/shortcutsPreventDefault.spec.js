// Copyright (C) 2017-2026 Smart code 203358507

const loadTs = require('./helpers/loadTs');
const shortcuts = require('../src/common/Shortcuts/shortcuts.json');

const { shouldPreventDefault } = loadTs('src/common/Shortcuts/preventDefault.ts');

const allShortcuts = shortcuts.flatMap((group) => group.shortcuts);

describe('shouldPreventDefault (#203)', () => {
    test('blocks Ctrl+G so the browser does not open "find next"', () => {
        expect(shouldPreventDefault('gamepadGuide', ['Ctrl', 'G'])).toBe(true);
    });

    test('blocks Ctrl+/ and Ctrl+Backspace', () => {
        expect(shouldPreventDefault('shortcuts', ['Ctrl', '/'])).toBe(true);
        expect(shouldPreventDefault('navigateHistory', ['Ctrl', 'Backspace'])).toBe(true);
    });

    test('keeps blocking interface zoom', () => {
        const { combos } = allShortcuts.find(({ name }) => name === 'interfaceScale');
        combos.forEach((keys) => {
            expect(shouldPreventDefault('interfaceScale', keys)).toBe(true);
        });
    });

    test('leaves plain keys alone', () => {
        expect(shouldPreventDefault('navigateHistory', ['Backspace'])).toBe(false);
        expect(shouldPreventDefault('fullscreen', ['F'])).toBe(false);
        expect(shouldPreventDefault('navigateTabs', ['1', '2', '3', '4', '5', '6'])).toBe(false);
    });

    test('leaves Shift-only combos alone', () => {
        expect(shouldPreventDefault('seekForward', ['Shift', 'ArrowRight'])).toBe(false);
    });

    test('covers every Ctrl/Mod combo in shortcuts.json', () => {
        allShortcuts.forEach(({ name, combos }) => {
            combos
                .filter((keys) => keys.includes('Ctrl') || keys.includes('Mod'))
                .forEach((keys) => expect(shouldPreventDefault(name, keys)).toBe(true));
        });
    });
});

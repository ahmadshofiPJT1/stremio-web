// Copyright (C) 2017-2026 Smart code 203358507

// Combos that hold Ctrl (or the platform primary modifier) usually clash with a
// browser shortcut, e.g. Ctrl+G is "find next" (#203). When such a combo matches
// one of our shortcuts, the browser action has to be blocked.
const shouldPreventDefault = (name: string, keys: string[]) => {
    return name === 'interfaceScale' || keys.includes('Ctrl') || keys.includes('Mod');
};

export {
    shouldPreventDefault,
};

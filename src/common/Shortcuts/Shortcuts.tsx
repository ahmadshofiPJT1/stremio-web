import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PRIMARY_MODIFIER, getKeyboardShortcutKey, getKeyboardShortcutKeys } from './keyboard';
import { shouldPreventDefault } from './preventDefault';
import { findConflict, isLocked, resetShortcut as resetShortcutOverride, resolveShortcuts, setBinding as setBindingOverride } from './bindings';
import { STORAGE_KEY, loadOverrides, saveOverrides } from './overridesStorage';
import shortcuts from './shortcuts.json';

export type ShortcutName = string;
export type ShortcutListener = (combo: number, key: string, repeat: boolean) => void;

interface ShortcutsContext {
    grouped: EffectiveShortcutGroup[],
    defaults: ShortcutGroup[],
    isLocked: (name: ShortcutName) => boolean,
    findConflict: (combo: string[], target: ShortcutTarget) => ShortcutConflict | null,
    setBinding: (target: ShortcutTarget, combo: string[], swap?: boolean) => void,
    resetShortcut: (name: ShortcutName) => void,
    resetAll: () => void,
    setRecording: (recording: boolean) => void,
    on: (name: ShortcutName, listener: ShortcutListener) => void,
    off: (name: ShortcutName, listener: ShortcutListener) => void,
}

const ShortcutsContext = createContext<ShortcutsContext>({} as ShortcutsContext);

type Props = {
    children: JSX.Element,
    onShortcut: (name: ShortcutName, combo: number, key: string) => void,
};

const REPEAT_THROTTLE_MS = 130;
const ZOOM_KEY_ALIASES: Record<string, string[]> = {
    '+': ['=', 'Equal', 'NumpadAdd'],
    '-': ['Minus', 'NumpadSubtract'],
    '0': ['Digit0', 'Numpad0'],
};

const isInputFocused = () => {
    const inputElements = ['INPUT', 'TEXTAREA', 'SELECT'];
    const activeElement = document.activeElement;

    return activeElement instanceof HTMLElement &&
        (inputElements.includes(activeElement.tagName) || activeElement.isContentEditable);
};

const ShortcutsProvider = ({ children, onShortcut }: Props) => {
    const listeners = useRef<Map<ShortcutName, Set<ShortcutListener>>>(new Map());
    const lastRepeatTime = useRef<Map<string, number>>(new Map());
    const recording = useRef(false);
    const [overrides, setOverrides] = useState<ShortcutOverrides>(loadOverrides);
    const overridesRef = useRef(overrides);

    const grouped = useMemo(() => resolveShortcuts(shortcuts, overrides) as EffectiveShortcutGroup[], [overrides]);
    const effectiveShortcuts = useMemo(() => grouped.map(({ shortcuts }) => shortcuts).flat(), [grouped]);

    const updateOverrides = useCallback((next: ShortcutOverrides) => {
        if (next === overridesRef.current) return;
        overridesRef.current = next;
        setOverrides(next);
        saveOverrides(next);
    }, []);

    const onKeyDown = useCallback((event: KeyboardEvent) => {
        const { ctrlKey, shiftKey, altKey, metaKey, key, repeat } = event;
        // While a shortcut is being recorded in Settings nothing may fire.
        if (event.isComposing || recording.current) return;
        const inputFocused = isInputFocused();

        const shortcutKeys = getKeyboardShortcutKeys(event);
        const repeatKey = getKeyboardShortcutKey(event);
        const now = Date.now();
        const throttled = repeat && now - (lastRepeatTime.current.get(repeatKey) ?? 0) < REPEAT_THROTTLE_MS;
        if (repeat && !throttled) lastRepeatTime.current.set(repeatKey, now);

        effectiveShortcuts.forEach(({ name, combos }) => combos.forEach((keys) => {
            const interfaceScale = name === 'interfaceScale';
            if (inputFocused && !interfaceScale) return;

            const primary = keys.includes('Mod');
            const modifiers = ((keys.includes('Ctrl') || (primary && PRIMARY_MODIFIER === 'Ctrl')) === ctrlKey)
                && ((primary && PRIMARY_MODIFIER === 'Meta') === metaKey)
                && (keys.includes('Shift') === shiftKey || (interfaceScale && (keys.includes('+') || keys.includes('0'))))
                && !altKey
                && !event.getModifierState('AltGraph');
            const keyMatched = keys.some((shortcutKey) => (
                shortcutKey !== 'Ctrl'
                && shortcutKey !== 'Shift'
                && shortcutKey !== 'Mod'
                && (shortcutKeys.includes(shortcutKey) || (interfaceScale && ZOOM_KEY_ALIASES[shortcutKey]?.some((alias) => shortcutKeys.includes(alias))))
            ));

            if (modifiers && keyMatched) {
                // Block the browser action for modifier combos (zoom, Ctrl+G find next, ...).
                // Do it before the throttle check so held keys are consumed too.
                if (shouldPreventDefault(name, keys)) event.preventDefault();
                if (throttled) return;
                const combo = combos.indexOf(keys);
                listeners.current.get(name)?.forEach((listener) => listener(combo, key, repeat));

                onShortcut(name as ShortcutName, combo, key);
            }
        }));
    }, [onShortcut, effectiveShortcuts]);

    const on = useCallback((name: ShortcutName, listener: ShortcutListener) => {
        !listeners.current.has(name) && listeners.current.set(name, new Set());
        listeners.current.get(name)!.add(listener);
    }, []);

    const off = useCallback((name: ShortcutName, listener: ShortcutListener) => {
        listeners.current.get(name)?.delete(listener);
    }, []);

    const setBinding = useCallback((target: ShortcutTarget, combo: string[], swap = false) => {
        updateOverrides(setBindingOverride(overridesRef.current, shortcuts, target, combo, { swap, primaryModifier: PRIMARY_MODIFIER }));
    }, [updateOverrides]);

    const resetShortcut = useCallback((name: ShortcutName) => {
        updateOverrides(resetShortcutOverride(overridesRef.current, name, shortcuts, PRIMARY_MODIFIER));
    }, [updateOverrides]);

    const resetAll = useCallback(() => {
        updateOverrides({});
    }, [updateOverrides]);

    const setRecording = useCallback((value: boolean) => {
        recording.current = value;
    }, []);

    const findShortcutConflict = useCallback((combo: string[], target: ShortcutTarget) => {
        return findConflict(grouped, combo, target, PRIMARY_MODIFIER);
    }, [grouped]);

    const value = useMemo(() => ({
        grouped,
        defaults: shortcuts,
        isLocked,
        findConflict: findShortcutConflict,
        setBinding,
        resetShortcut,
        resetAll,
        setRecording,
        on,
        off,
    }), [grouped, findShortcutConflict, setBinding, resetShortcut, resetAll, setRecording, on, off]);

    // Keep other tabs in sync (the storage event only fires in the other documents).
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== STORAGE_KEY) return;
            const next = loadOverrides();
            overridesRef.current = next;
            setOverrides(next);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onKeyDown]);

    return (
        <ShortcutsContext.Provider value={value}>
            {children}
        </ShortcutsContext.Provider>
    );
};

const useShortcuts = () => {
    return useContext(ShortcutsContext);
};

export {
    ShortcutsProvider,
    useShortcuts,
};

// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useEffect, useState } from 'react';
import { useShortcuts } from 'stremio/common';
import { comboFromKeyEvent } from 'stremio/common/Shortcuts/bindings';
import { PRIMARY_MODIFIER, normalizeKeyboardKey } from 'stremio/common/Shortcuts/keyboard';

type Editing = {
    target: ShortcutTarget,
    // 'recording': waiting for a key press. 'confirm': an editable slot owns the combo, Swap or Cancel.
    phase: 'recording' | 'confirm',
    combo: string[] | null,
    conflict: ShortcutConflict | null,
    error: 'alt' | 'reserved' | 'unsupported' | null,
};

const useShortcutRecorder = () => {
    const { findConflict, setBinding, setRecording } = useShortcuts();
    const [editing, setEditing] = useState<Editing | null>(null);

    const start = useCallback((target: ShortcutTarget) => {
        setEditing({ target, phase: 'recording', combo: null, conflict: null, error: null });
    }, []);

    const cancel = useCallback(() => {
        setEditing(null);
    }, []);

    const confirmSwap = useCallback(() => {
        if (editing?.phase === 'confirm' && editing.combo) {
            setBinding(editing.target, editing.combo, true);
        }
        setEditing(null);
    }, [editing, setBinding]);

    const active = editing !== null;
    const target = editing?.target;
    const phase = editing?.phase;

    useEffect(() => {
        if (!active || !target) return;

        setRecording(true);

        const onKeyDown = (event: KeyboardEvent) => {
            // Capture phase: nothing else (provider, fullscreen, modals, browser) may react.
            event.preventDefault();
            event.stopPropagation();
            if (event.repeat || event.isComposing) return;

            const key = normalizeKeyboardKey(event);
            const noModifiers = !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
            if (key === 'Escape' && noModifiers) {
                setEditing(null);
                return;
            }
            if (phase !== 'recording') return;

            const result = comboFromKeyEvent({
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                altGraph: event.getModifierState('AltGraph'),
            }, key, PRIMARY_MODIFIER);

            if ('error' in result) {
                if (result.error !== 'modifier-only') {
                    setEditing({ target, phase: 'recording', combo: null, conflict: null, error: result.error });
                }
                return;
            }

            const conflict = findConflict(result, target);
            if (conflict === null) {
                setBinding(target, result);
                setEditing(null);
            } else if (conflict.locked) {
                setEditing({ target, phase: 'recording', combo: result, conflict, error: null });
            } else {
                setEditing({ target, phase: 'confirm', combo: result, conflict, error: null });
            }
        };
        const onBlur = () => setEditing(null);

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('blur', onBlur);
            setRecording(false);
        };
    }, [active, target, phase, findConflict, setBinding, setRecording]);

    return { editing, start, cancel, confirmSwap };
};

export type { Editing };
export default useShortcutRecorder;

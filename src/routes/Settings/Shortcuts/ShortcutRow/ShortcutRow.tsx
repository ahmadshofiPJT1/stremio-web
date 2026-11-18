// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button } from 'stremio/components';
import Keys from 'stremio/components/ShortcutsGroup/Combos/Keys';
import type { Editing } from '../useShortcutRecorder';
import styles from './ShortcutRow.less';

// Slot labels for shortcuts whose slots do different things (verified against the handlers).
const SLOT_LABELS: Record<string, [string, string][]> = {
    volume: [['SETTINGS_SHORTCUT_VOLUME_UP', 'Volume up'], ['SETTINGS_SHORTCUT_VOLUME_DOWN', 'Volume down']],
    speed: [['SETTINGS_SHORTCUT_DECREASE_PLAYBACK_SPEED', 'Decrease playback speed'], ['SETTINGS_SHORTCUT_INCREASE_PLAYBACK_SPEED', 'Increase playback speed']],
    subtitlesSize: [['SETTINGS_SHORTCUT_DECREASE_SUB_SIZE', 'Decrease subtitles size'], ['SETTINGS_SHORTCUT_INCREASE_SUB_SIZE', 'Increase subtitles size']],
    navigateHistory: [['SETTINGS_SHORTCUT_GO_BACK', 'Go back'], ['SETTINGS_SHORTCUT_GO_FORWARD', 'Go forward']],
};

type Props = {
    shortcut: EffectiveShortcut,
    locked: boolean,
    editing: Editing | null,
    ownerLabel: (name: string) => string,
    onEdit: (slot: number) => void,
    onCancel: () => void,
    onSwap: () => void,
    onReset: () => void,
};

const ShortcutRow = ({ shortcut, locked, editing, ownerLabel, onEdit, onCancel, onSwap, onReset }: Props) => {
    const { t } = useTranslation();
    const overridden = shortcut.overridden.some(Boolean);
    const lockedLabel = t('SETTINGS_SHORTCUT_LOCKED', { defaultValue: 'Can\'t be changed yet' });

    const message = (() => {
        if (!editing) return null;
        if (editing.phase === 'confirm' && editing.conflict) {
            return t('SETTINGS_SHORTCUT_CONFLICT', { action: ownerLabel(editing.conflict.name), defaultValue: 'Already used by {{action}}' });
        }
        if (editing.conflict?.locked) {
            return t('SETTINGS_SHORTCUT_BLOCKED', { action: ownerLabel(editing.conflict.name), defaultValue: 'Used by {{action}}, which can\'t be changed yet' });
        }
        if (editing.error === 'alt') {
            return t('SETTINGS_SHORTCUT_NO_ALT', { defaultValue: 'Alt combinations are not supported' });
        }
        if (editing.error === 'reserved') {
            return t('SETTINGS_SHORTCUT_RESERVED', { defaultValue: 'Reserved by the browser or app' });
        }
        if (editing.error === 'unsupported') {
            return t('SETTINGS_SHORTCUT_UNSUPPORTED', { defaultValue: 'This key can\'t be used' });
        }
        return null;
    })();

    return (
        <div className={styles['shortcut']}>
            <div className={styles['main']}>
                <div className={styles['label']}>
                    {t(shortcut.label)}
                    {
                        locked &&
                            <span className={styles['locked']} title={lockedLabel}>
                                {lockedLabel}
                            </span>
                    }
                </div>
                <div className={styles['combos']}>
                    {
                        shortcut.combos.map((keys, slot) => {
                            const slotLabel = SLOT_LABELS[shortcut.name]?.[slot];
                            const recording = editing?.target.slot === slot;
                            return (
                                <div className={styles['combo']} key={slot}>
                                    {
                                        locked ?
                                            <Keys keys={keys} />
                                            :
                                            <Button
                                                className={classNames(styles['slot'], { [styles['recording']]: recording, [styles['overridden']]: shortcut.overridden[slot] })}
                                                title={slotLabel ? t(slotLabel[0], { defaultValue: slotLabel[1] }) : t(shortcut.label)}
                                                onClick={() => onEdit(slot)}
                                            >
                                                {
                                                    recording ?
                                                        <span className={styles['prompt']}>
                                                            {t('SETTINGS_SHORTCUT_RECORDING', { defaultValue: 'Press a key combination… (Esc to cancel)' })}
                                                        </span>
                                                        :
                                                        <Keys keys={keys} />
                                                }
                                            </Button>
                                    }
                                    {
                                        slot < shortcut.combos.length - 1 &&
                                            <div className={styles['separator']}>{t('SETTINGS_SHORTCUT_OR')}</div>
                                    }
                                </div>
                            );
                        })
                    }
                    {
                        !locked && overridden &&
                            <Button className={styles['action']} onClick={onReset}>
                                {t('SETTINGS_SHORTCUT_RESET', { defaultValue: 'Reset' })}
                            </Button>
                    }
                </div>
            </div>
            {
                message &&
                    <div className={styles['message']}>
                        <span>{message}</span>
                        {
                            editing?.phase === 'confirm' &&
                                <Button className={styles['action']} onClick={onSwap}>
                                    {t('SETTINGS_SHORTCUT_SWAP', { defaultValue: 'Swap' })}
                                </Button>
                        }
                        {
                            editing?.phase === 'confirm' &&
                                <Button className={styles['action']} onClick={onCancel}>
                                    {t('BUTTON_CANCEL')}
                                </Button>
                        }
                    </div>
            }
        </div>
    );
};

export default ShortcutRow;

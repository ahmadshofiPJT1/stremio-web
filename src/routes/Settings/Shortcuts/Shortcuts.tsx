import React, { forwardRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Section } from '../components';
import { Button } from 'stremio/components';
import { useShortcuts } from 'stremio/common';
import ShortcutRow from './ShortcutRow';
import useShortcutRecorder from './useShortcutRecorder';
import styles from './Shortcuts.less';

const Shortcuts = forwardRef<HTMLDivElement>((_, ref) => {
    const { t } = useTranslation();
    const { grouped, isLocked, resetShortcut, resetAll } = useShortcuts();
    const { editing, start, cancel, confirmSwap } = useShortcutRecorder();

    const ownerLabel = useCallback((name: string) => {
        const shortcut = grouped.flatMap(({ shortcuts }) => shortcuts).find((item) => item.name === name);
        return shortcut ? t(shortcut.label) : name;
    }, [grouped, t]);

    return (
        <Section ref={ref} label={'SETTINGS_NAV_SHORTCUTS'}>
            <div className={styles['toolbar']}>
                <Button className={styles['reset-all']} onClick={resetAll}>
                    {t('SETTINGS_SHORTCUT_RESET_ALL', { defaultValue: 'Reset all' })}
                </Button>
            </div>
            {
                grouped.map(({ name, label, shortcuts }) => (
                    <div key={name} className={styles['shortcuts-group']}>
                        <div className={styles['title']}>{t(label)}</div>
                        <div className={styles['shortcuts']}>
                            {
                                shortcuts.map((shortcut) => (
                                    <ShortcutRow
                                        key={shortcut.name}
                                        shortcut={shortcut}
                                        locked={isLocked(shortcut.name)}
                                        editing={editing?.target.name === shortcut.name ? editing : null}
                                        ownerLabel={ownerLabel}
                                        onEdit={(slot) => start({ name: shortcut.name, slot })}
                                        onCancel={cancel}
                                        onSwap={confirmSwap}
                                        onReset={() => resetShortcut(shortcut.name)}
                                    />
                                ))
                            }
                        </div>
                    </div>
                ))
            }
        </Section>
    );
});

export default Shortcuts;

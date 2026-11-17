// Copyright (C) 2017-2026 Smart code 203358507

const loadTs = require('./helpers/loadTs');

const {
    MAX_SUBTITLES_REAPPLY_ATTEMPTS,
    getSelectedSubtitlesTrack,
    getSubtitlesReapplyAction,
} = loadTs('src/routes/Player/subtitleReapply.ts');

const english = { id: 'en', source: 'embedded' };
const englishExternal = { id: 'en', source: 'external' };

describe('getSelectedSubtitlesTrack', () => {
    test('reads the embedded track first', () => {
        expect(getSelectedSubtitlesTrack('en', null)).toEqual(english);
    });

    test('reads the external track', () => {
        expect(getSelectedSubtitlesTrack(null, 'en')).toEqual(englishExternal);
    });

    test('returns null when nothing is selected', () => {
        expect(getSelectedSubtitlesTrack(null, null)).toBeNull();
    });
});

describe('getSubtitlesReapplyAction (#763)', () => {
    test('applies when nothing was applied yet', () => {
        expect(getSubtitlesReapplyAction(null, english, null, 0)).toBe('apply');
    });

    test('applies once per stream even if the engine already shows the track', () => {
        expect(getSubtitlesReapplyAction(null, english, english, 0)).toBe('apply');
    });

    test('applies when a different track is wanted', () => {
        const applied = { id: 'fr', source: 'embedded', confirmed: true };
        expect(getSubtitlesReapplyAction(applied, english, english, 0)).toBe('apply');
    });

    test('applies when the same id comes from another source', () => {
        const applied = { ...english, confirmed: true };
        expect(getSubtitlesReapplyAction(applied, englishExternal, null, 0)).toBe('apply');
    });

    test('waits while the engine has not reported the track yet', () => {
        const applied = { ...english, confirmed: false };
        expect(getSubtitlesReapplyAction(applied, english, null, 0)).toBe('wait');
    });

    test('confirms once the engine reports the track', () => {
        const applied = { ...english, confirmed: false };
        expect(getSubtitlesReapplyAction(applied, english, english, 0)).toBe('confirm');
    });

    test('does nothing while the confirmed track stays selected', () => {
        const applied = { ...english, confirmed: true };
        expect(getSubtitlesReapplyAction(applied, english, english, 0)).toBe('none');
    });

    test('reapplies when the engine drops a confirmed track', () => {
        const applied = { ...english, confirmed: true };
        expect(getSubtitlesReapplyAction(applied, english, null, 0)).toBe('reapply');
    });

    test('reapplies when the engine switches to another track on its own', () => {
        const applied = { ...english, confirmed: true };
        expect(getSubtitlesReapplyAction(applied, english, { id: 'fr', source: 'embedded' }, 0)).toBe('reapply');
    });

    test('gives up after the attempt limit', () => {
        const applied = { ...english, confirmed: true };
        expect(getSubtitlesReapplyAction(applied, english, null, MAX_SUBTITLES_REAPPLY_ATTEMPTS)).toBe('give-up');
    });
});

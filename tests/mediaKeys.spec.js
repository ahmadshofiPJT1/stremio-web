// Copyright (C) 2017-2026 Smart code 203358507

const loadTs = require('./helpers/loadTs');

const {
    MEDIA_KEY_DEDUPE_MS,
    getMediaKeyAction,
    isDuplicateMediaKey,
} = loadTs('src/routes/Player/mediaKeys.ts');

describe('getMediaKeyAction (#977)', () => {
    test('maps the media keys', () => {
        expect(getMediaKeyAction(['MediaPlayPause'])).toBe('play-pause');
        expect(getMediaKeyAction(['MediaPlay'])).toBe('play');
        expect(getMediaKeyAction(['MediaPause'])).toBe('pause');
    });

    test('falls back to the legacy keyCode', () => {
        expect(getMediaKeyAction(['Unidentified'], 179)).toBe('play-pause');
    });

    test('ignores other keys, including Space', () => {
        expect(getMediaKeyAction(['Space'], 32)).toBeNull();
        expect(getMediaKeyAction(['KeyK', 'K'], 75)).toBeNull();
    });
});

describe('isDuplicateMediaKey', () => {
    test('treats a second signal inside the window as a duplicate', () => {
        expect(isDuplicateMediaKey(1000, 1000 + MEDIA_KEY_DEDUPE_MS - 1)).toBe(true);
    });

    test('lets a later press through', () => {
        expect(isDuplicateMediaKey(1000, 1000 + MEDIA_KEY_DEDUPE_MS)).toBe(false);
        expect(isDuplicateMediaKey(-Infinity, 0)).toBe(false);
    });
});

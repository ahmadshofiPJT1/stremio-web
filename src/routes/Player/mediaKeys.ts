// Copyright (C) 2017-2026 Smart code 203358507

type MediaKeyAction = 'play-pause' | 'play' | 'pause';

// Some browsers report media keys through both keydown and the Media Session API.
// Ignore the second signal if it arrives this soon after the first one.
const MEDIA_KEY_DEDUPE_MS = 500;

// Legacy keyCode for the play/pause media key (older WebViews report key as 'Unidentified').
const MEDIA_PLAY_PAUSE_KEY_CODE = 179;

const MEDIA_KEYS: Record<string, MediaKeyAction> = {
    MediaPlayPause: 'play-pause',
    MediaPlay: 'play',
    MediaPause: 'pause',
};

const getMediaKeyAction = (keys: string[], keyCode?: number): MediaKeyAction | null => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(MEDIA_KEYS, key)) {
            return MEDIA_KEYS[key];
        }
    }

    return keyCode === MEDIA_PLAY_PAUSE_KEY_CODE ? 'play-pause' : null;
};

const isDuplicateMediaKey = (lastHandledAt: number, now: number) => {
    return now - lastHandledAt < MEDIA_KEY_DEDUPE_MS;
};

export {
    MEDIA_KEY_DEDUPE_MS,
    getMediaKeyAction,
    isDuplicateMediaKey,
};

export type {
    MediaKeyAction,
};

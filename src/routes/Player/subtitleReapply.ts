// Copyright (C) 2017-2026 Smart code 203358507

// How many times per stream we put a subtitle track back after the video
// engine dropped it on its own. Keeps us out of a loop if the engine keeps refusing it.
const MAX_SUBTITLES_REAPPLY_ATTEMPTS = 3;

type SubtitlesTrackRef = {
    id: string,
    source: 'embedded' | 'external',
};

type AppliedSubtitlesTrack = SubtitlesTrackRef & {
    // True once the engine has reported this track as selected.
    confirmed: boolean,
};

type SubtitlesReapplyAction =
    // Nothing applied yet, or a different track is wanted.
    | 'apply'
    // The engine just reported the track we applied.
    | 'confirm'
    // Applied and confirmed, nothing to do.
    | 'none'
    // Applied, engine has not reported it yet.
    | 'wait'
    // Engine dropped a confirmed track, put it back.
    | 'reapply'
    // Engine dropped it too many times, stop trying.
    | 'give-up';

const getSelectedSubtitlesTrack = (
    selectedSubtitlesTrackId: string | null | undefined,
    selectedExtraSubtitlesTrackId: string | null | undefined,
): SubtitlesTrackRef | null => {
    if (selectedSubtitlesTrackId) {
        return { id: selectedSubtitlesTrackId, source: 'embedded' };
    }

    if (selectedExtraSubtitlesTrackId) {
        return { id: selectedExtraSubtitlesTrackId, source: 'external' };
    }

    return null;
};

const getSubtitlesReapplyAction = (
    applied: AppliedSubtitlesTrack | null,
    target: SubtitlesTrackRef,
    selected: SubtitlesTrackRef | null,
    attempts: number,
): SubtitlesReapplyAction => {
    if (!applied || applied.id !== target.id || applied.source !== target.source) {
        return 'apply';
    }

    const engineHasTrack = selected !== null && selected.id === target.id && selected.source === target.source;
    if (engineHasTrack) {
        return applied.confirmed ? 'none' : 'confirm';
    }

    if (!applied.confirmed) {
        return 'wait';
    }

    return attempts < MAX_SUBTITLES_REAPPLY_ATTEMPTS ? 'reapply' : 'give-up';
};

export {
    MAX_SUBTITLES_REAPPLY_ATTEMPTS,
    getSelectedSubtitlesTrack,
    getSubtitlesReapplyAction,
};

export type {
    AppliedSubtitlesTrack,
    SubtitlesReapplyAction,
    SubtitlesTrackRef,
};

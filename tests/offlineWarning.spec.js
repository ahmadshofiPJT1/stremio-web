// Copyright (C) 2017-2026 Smart code 203358507

const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('offline warning (#95)', () => {
    test('useOnlineStatus listens to online and offline events', () => {
        const source = read('src/common/useOnlineStatus.ts');
        expect(source).toContain('navigator.onLine');
        expect(source).toContain('\'online\'');
        expect(source).toContain('\'offline\'');
    });

    test('StreamsList shows the translated text, not a literal', () => {
        const source = read('src/routes/MetaDetails/StreamsList/StreamsList.js');
        expect(source).toContain('useOnlineStatus()');
        expect(source).toContain('t(\'NOTIFICATION_OFFLINE\')');
        expect(source).toContain('role={\'status\'}');
    });

    test('NOTIFICATION_OFFLINE exists in the pinned translations', () => {
        const translations = require('stremio-translations/en-US.json');
        expect(typeof translations.NOTIFICATION_OFFLINE).toBe('string');
    });
});

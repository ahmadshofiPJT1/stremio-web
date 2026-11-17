// Copyright (C) 2017-2026 Smart code 203358507

import { useSyncExternalStore } from 'react';

const subscribe = (onStoreChange: () => void) => {
    window.addEventListener('online', onStoreChange);
    window.addEventListener('offline', onStoreChange);
    return () => {
        window.removeEventListener('online', onStoreChange);
        window.removeEventListener('offline', onStoreChange);
    };
};

// navigator.onLine only knows about the network link, not real internet access.
// Treat an unknown value as online so we never show a false offline warning.
const getSnapshot = () => typeof navigator === 'undefined' || navigator.onLine !== false;

const getServerSnapshot = () => true;

const useOnlineStatus = (): boolean => {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

export default useOnlineStatus;

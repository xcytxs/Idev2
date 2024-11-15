import { useCallback, useEffect, useRef } from 'react';

export const useWaitForLoading = (isLoading:boolean) => {
    const pendingPromises = useRef(new Set<{resolve:()=>void,reject:(error:Error)=>void}>());

    // Cleanup and reject pending promises on unmount
    useEffect(() => {
        return () => {
            pendingPromises.current.forEach(({ reject }) => {
                reject(new Error('Component unmounted'));
            });
            pendingPromises.current.clear();
        };
    }, []);

    // Resolve promises when loading completes
    useEffect(() => {
        if (!isLoading) {
            pendingPromises.current.forEach(({ resolve }) => resolve());
            pendingPromises.current.clear();
        }
    }, [isLoading]);

    return useCallback(() => {
        if (!isLoading) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            pendingPromises.current.add({ resolve, reject });
        });
    }, [isLoading]);
};
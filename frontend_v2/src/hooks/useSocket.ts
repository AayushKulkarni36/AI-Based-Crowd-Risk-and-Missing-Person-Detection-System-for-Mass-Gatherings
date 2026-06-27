/**
 * useSocket — thin wrapper around SocketContext.
 *
 * All pages that import { useSocket } keep working without changes.
 * The actual socket lives in SocketContext (singleton per auth session).
 */
import { useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';

export function useSocket() {
    const { socket, isConnected, queueStats } = useSocketContext();

    const emit = useCallback((event: string, data?: any) => {
        socket?.emit(event, data);
    }, [socket]);

    const on = useCallback((event: string, callback: (data: any) => void) => {
        socket?.on(event, callback);
    }, [socket]);

    const off = useCallback((event: string, callback?: (data: any) => void) => {
        if (callback) {
            socket?.off(event, callback);
        } else {
            socket?.off(event);
        }
    }, [socket]);

    return { socket, isConnected, queueStats, emit, on, off };
}

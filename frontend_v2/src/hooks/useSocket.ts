import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}

export function useSocket() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [queueStats, setQueueStats] = useState<QueueStats>({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
    });

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const newSocket = io(`${SOCKET_URL}/events`, {
            auth: {
                token
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        newSocket.on('queue:stats', (stats: QueueStats) => {
            setQueueStats(stats);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, []);

    const emit = useCallback((event: string, data?: any) => {
        if (socket) {
            socket.emit(event, data);
        }
    }, [socket]);

    const on = useCallback((event: string, callback: (data: any) => void) => {
        if (socket) {
            socket.on(event, callback);
        }
    }, [socket]);

    const off = useCallback((event: string) => {
        if (socket) {
            socket.off(event);
        }
    }, [socket]);

    return {
        socket,
        isConnected,
        queueStats,
        emit,
        on,
        off
    };
}

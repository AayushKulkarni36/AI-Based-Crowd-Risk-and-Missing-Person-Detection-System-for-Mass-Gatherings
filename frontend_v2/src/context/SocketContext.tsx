/**
 * SocketContext — provides a single, app-wide Socket.io connection.
 *
 * One socket is created when the user is authenticated and destroyed
 * when they log out. This prevents the connect/disconnect spam that
 * occurs when each page component creates its own socket instance.
 */
import {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
    ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

interface QueueStats {
    waiting:   number;
    active:    number;
    completed: number;
    failed:    number;
}

interface SocketContextType {
    socket:      Socket | null;
    isConnected: boolean;
    queueStats:  QueueStats;
}

const SocketContext = createContext<SocketContextType>({
    socket:      null,
    isConnected: false,
    queueStats:  { waiting: 0, active: 0, completed: 0, failed: 0 },
});

export function SocketProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [socket, setSocket]           = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [queueStats, setQueueStats]   = useState<QueueStats>({
        waiting: 0, active: 0, completed: 0, failed: 0,
    });

    // Keep a ref so the cleanup function always has the latest socket
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Only create a socket when the user is authenticated
        if (!isAuthenticated) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) return;

        const newSocket = io(`${SOCKET_URL}/events`, {
            auth:                  { token },
            transports:            ['websocket', 'polling'],
            reconnection:          true,
            reconnectionDelay:     1000,
            reconnectionDelayMax:  5000,
            reconnectionAttempts:  Infinity, // never give up
            timeout:               20000,
            autoConnect:           true,
        });

        newSocket.on('connect', () => {
            console.log('[Socket] Connected:', newSocket.id);
            setIsConnected(true);
        });

        // Log-only — NEVER call logout() on socket disconnect events
        newSocket.on('disconnect', (reason: string) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        newSocket.on('reconnect', (attempt: number) => {
            console.log('[Socket] Reconnected after', attempt, 'attempt(s)');
        });

        newSocket.on('reconnect_attempt', (attempt: number) => {
            console.log('[Socket] Reconnect attempt', attempt);
        });

        newSocket.on('reconnect_error', (err: Error) => {
            console.warn('[Socket] Reconnect error:', err.message);
        });

        newSocket.on('queue:stats', (stats: QueueStats) => {
            setQueueStats(stats);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Cleanup: disconnect when user logs out or component unmounts
        return () => {
            console.log('[Socket] Cleaning up connection');
            newSocket.disconnect();
            socketRef.current = null;
        };
    }, [isAuthenticated]); // re-run only when auth state changes

    return (
        <SocketContext.Provider value={{ socket, isConnected, queueStats }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocketContext() {
    return useContext(SocketContext);
}

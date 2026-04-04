import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MissingPerson, VideoStatus, api } from '../services/api';

interface AppContextType {
    activePersonVideos: Map<string, VideoStatus>;
    crowdVideos: Map<string, VideoStatus>;
    registeredPersons: MissingPerson[];

    // Actions
    updatePersonVideoStatus: (id: string, status: VideoStatus) => void;
    updateCrowdVideoStatus: (id: string, status: VideoStatus) => void;
    refreshPersons: () => Promise<void>;

    // UI State
    showHeatmap: boolean;
    setShowHeatmap: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const [activePersonVideos, setActivePersonVideos] = useState<Map<string, VideoStatus>>(new Map());
    const [crowdVideos, setCrowdVideos] = useState<Map<string, VideoStatus>>(new Map());
    const [registeredPersons, setRegisteredPersons] = useState<MissingPerson[]>([]);
    const [showHeatmap, setShowHeatmap] = useState(false);

    useEffect(() => {
        refreshPersons();
    }, []);

    const refreshPersons = async () => {
        try {
            const { persons } = await api.getMissingPersons();
            setRegisteredPersons(persons);
        } catch (e) {
            console.error("Failed to load persons", e);
        }
    };

    const updatePersonVideoStatus = (id: string, status: VideoStatus) => {
        setActivePersonVideos(prev => new Map(prev).set(id, status));
    };

    const updateCrowdVideoStatus = (id: string, status: VideoStatus) => {
        setCrowdVideos(prev => new Map(prev).set(id, status));
    };

    return (
        <AppContext.Provider value={{
            activePersonVideos,
            crowdVideos,
            registeredPersons,
            updatePersonVideoStatus,
            updateCrowdVideoStatus,
            refreshPersons,
            showHeatmap,
            setShowHeatmap
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}

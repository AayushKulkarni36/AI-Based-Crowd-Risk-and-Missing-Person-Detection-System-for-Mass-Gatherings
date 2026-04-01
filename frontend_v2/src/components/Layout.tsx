import { ReactNode } from 'react';
import Navbar from './Navbar';
import { motion } from 'framer-motion';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden text-white font-sans selection:bg-brand-primary selection:text-white">
            {/* Animated Background Blobs */}
            <div className="fixed inset-0 pointer-events-none z-[-1]">
                <div className="absolute top-0 -left-4 w-96 h-96 bg-brand-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-0 -right-4 w-96 h-96 bg-brand-secondary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-20 w-96 h-96 bg-brand-accent/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>

            <Navbar />
            <motion.main
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex-grow container mx-auto px-4 py-8"
            >
                {children}
            </motion.main>
        </div>
    );
}

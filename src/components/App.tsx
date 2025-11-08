"use client";

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import Login from './Login';
import MockPage from './MockPage';

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center min-h-full">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const App: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <main className="h-full font-sans text-gray-100">
            {user ? <MockPage user={user} /> : <Login />}
        </main>
    );
};

export default App;

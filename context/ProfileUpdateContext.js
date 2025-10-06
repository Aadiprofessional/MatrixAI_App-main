import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const ProfileUpdateContext = createContext();

export const ProfileUpdateProvider = ({ children }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const triggerUpdate = useCallback(() => {
    setLastUpdate(Date.now());
  }, []);

  const value = useMemo(() => ({
    lastUpdate,
    triggerUpdate
  }), [lastUpdate, triggerUpdate]);

  return (
    <ProfileUpdateContext.Provider value={value}>
      {children}
    </ProfileUpdateContext.Provider>
  );
};

export const useProfileUpdate = () => {
  const context = useContext(ProfileUpdateContext);
  if (!context) {
    throw new Error('useProfileUpdate must be used within a ProfileUpdateProvider');
  }
  return context;
};
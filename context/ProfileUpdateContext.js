import React, { createContext, useContext, useState } from 'react';

const ProfileUpdateContext = createContext();

export const ProfileUpdateProvider = ({ children }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const triggerUpdate = () => {
    setLastUpdate(Date.now());
  };

  return (
    <ProfileUpdateContext.Provider value={{ lastUpdate, triggerUpdate }}>
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
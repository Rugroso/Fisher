import React, { createContext, useContext, useState } from 'react';

interface OceanModeContextType {
  isOceanMode: boolean;
  toggleOceanMode: () => void;
  scrollProgress: number;
  setScrollProgress: (progress: number) => void;
}

const OceanModeContext = createContext<OceanModeContextType | undefined>(undefined);

export function OceanModeProvider({ children }: { children: React.ReactNode }) {
  const [isOceanMode, setIsOceanMode] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const toggleOceanMode = () => {
    setIsOceanMode(!isOceanMode);
    if (!isOceanMode) {
      setScrollProgress(0);
    }
  };

  return (
    <OceanModeContext.Provider value={{ isOceanMode, toggleOceanMode, scrollProgress, setScrollProgress }}>
      {children}
    </OceanModeContext.Provider>
  );
}

export function useOceanMode() {
  const context = useContext(OceanModeContext);
  if (context === undefined) {
    throw new Error('useOceanMode must be used within an OceanModeProvider');
  }
  return context;
} 
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type DisplayPreferencesContextType = {
  boardTheme: string;
  pieceTheme: string;
  soundEnabled: boolean;
  setBoardTheme: (theme: string) => void;
  setPieceTheme: (theme: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
};

const DisplayPreferencesContext = createContext<DisplayPreferencesContextType | undefined>(undefined);

export function DisplayPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [boardTheme, setBoardThemeState] = useState("burled_wood");
  const [pieceTheme, setPieceThemeState] = useState("glass");
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    try {
      const savedBoard = localStorage.getItem("ChessLearn-boardTheme");
      const savedPiece = localStorage.getItem("ChessLearn-pieceTheme");
      const savedSound = localStorage.getItem("ChessLearn-soundEnabled");

      if (savedBoard) setBoardThemeState(savedBoard);
      if (savedPiece) setPieceThemeState(savedPiece);
      if (savedSound) setSoundEnabledState(savedSound === "true");
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  const setBoardTheme = (theme: string) => {
    setBoardThemeState(theme);
    try {
      localStorage.setItem("ChessLearn-boardTheme", theme);
    } catch (e) {}
  };

  const setPieceTheme = (theme: string) => {
    setPieceThemeState(theme);
    try {
      localStorage.setItem("ChessLearn-pieceTheme", theme);
    } catch (e) {}
  };

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem("ChessLearn-soundEnabled", enabled ? "true" : "false");
    } catch (e) {}
  };

  return (
    <DisplayPreferencesContext.Provider
      value={{
        boardTheme,
        pieceTheme,
        soundEnabled,
        setBoardTheme,
        setPieceTheme,
        setSoundEnabled,
      }}
    >
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences() {
  const context = useContext(DisplayPreferencesContext);
  if (context === undefined) {
    throw new Error("useDisplayPreferences must be used within a DisplayPreferencesProvider");
  }
  return context;
}

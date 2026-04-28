import { createContext, useContext, useState } from 'react';

// ── Defaults (safe to call outside the provider) ──────────────────────────────
const SettingsContext = createContext({
  colorblind:    false,
  setColorblind: () => {},
});

export const useSettings = () => useContext(SettingsContext);

// ── Apply class to <html> synchronously (called during render & on change) ───
function applyClasses(colorblind) {
  document.documentElement.classList.toggle('colorblind-mode', !!colorblind);
}

export function SettingsProvider({ children }) {
  const [colorblind, _setColorblind] = useState(() => {
    const v = localStorage.getItem('cg-colorblind') === 'true';
    applyClasses(v);
    return v;
  });

  function setColorblind(v) {
    _setColorblind(v);
    localStorage.setItem('cg-colorblind', String(v));
    applyClasses(v);
  }

  return (
    <SettingsContext.Provider value={{ colorblind, setColorblind }}>
      {children}
    </SettingsContext.Provider>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildDefaultConfig } from '../lib/profile.js';
import { clearStoredSession, createEmptySession, loadSession, saveSession } from '../lib/storage.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => loadSession() || createEmptySession());
  const [storageWarning, setStorageWarning] = useState(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const result = saveSession(session);
      setStorageWarning(result.ok ? null : result.message);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [session]);

  const updateSession = useCallback((updater) => {
    setSession((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : { ...previous, ...updater };
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const applyImport = useCallback(({ source, dataset, activity }) => {
    const defaults = buildDefaultConfig(dataset.columns, dataset.rowCount);
    setSession((previous) => ({
      ...previous,
      version: 1,
      updatedAt: new Date().toISOString(),
      source,
      sourceReference: null,
      dataset,
      config: defaults,
      prepared: false,
      activity: (activity || []).slice(-40),
      report: null,
    }));
  }, []);

  const loadSample = useCallback(async () => {
    setSampleLoading(true);
    try {
      const { loadSampleDataset } = await import('../lib/importDataset.js');
      const bundle = loadSampleDataset();
      applyImport(bundle);
      return bundle;
    } finally {
      setSampleLoading(false);
    }
  }, [applyImport]);

  const updateConfig = useCallback(
    (patch) => {
      setSession((previous) => {
        if (!previous.dataset) return previous;
        return {
          ...previous,
          updatedAt: new Date().toISOString(),
          config: {
            ...previous.config,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const markPrepared = useCallback(() => {
    setSession((previous) =>
      previous.dataset && previous.config?.measureKey
        ? { ...previous, prepared: true, updatedAt: new Date().toISOString() }
        : previous,
    );
  }, []);

  const setSourceReference = useCallback((reference) => {
    setSession((previous) => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      sourceReference: reference,
    }));
  }, []);

  const addActivity = useCallback((entries) => {
    setSession((previous) => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      activity: [...previous.activity, ...entries].slice(-40),
    }));
  }, []);

  const saveReport = useCallback((report) => {
    setSession((previous) => ({
      ...previous,
      prepared: true,
      report,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const resetSession = useCallback(() => {
    clearStoredSession();
    setSession(createEmptySession());
    setStorageWarning(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      storageWarning,
      sampleLoading,
      updateSession,
      applyImport,
      loadSample,
      updateConfig,
      markPrepared,
      setSourceReference,
      addActivity,
      saveReport,
      resetSession,
    }),
    [
      session,
      storageWarning,
      sampleLoading,
      updateSession,
      applyImport,
      loadSample,
      updateConfig,
      markPrepared,
      setSourceReference,
      addActivity,
      saveReport,
      resetSession,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

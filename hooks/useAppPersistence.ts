import { useCallback, useEffect, useRef } from 'react';
import { AppSettings, Project, Template } from '../types';

interface PersistenceService {
  saveToDisk: (key: string, data: unknown) => Promise<void>;
}

interface UseAppPersistenceOptions {
  projects: Project[];
  templates: Template[];
  settings: AppSettings;
  hasLoaded: boolean;
  ioService: PersistenceService;
  storageKeys: {
    PROJECTS: string;
    TEMPLATES: string;
    SETTINGS: string;
  };
  onPersistError: () => void;
}

export const useAppPersistence = ({
  projects,
  templates,
  settings,
  hasLoaded,
  ioService,
  storageKeys,
  onPersistError,
}: UseAppPersistenceOptions) => {
  const persistTimers = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});

  const debouncedSave = useCallback(
    (key: string, data: unknown, delay = 500) => {
      if (persistTimers.current[key]) {
        clearTimeout(persistTimers.current[key]);
      }

      persistTimers.current[key] = setTimeout(() => {
        ioService.saveToDisk(key, data).catch(() => {
          onPersistError();
        });
      }, delay);
    },
    [ioService, onPersistError]
  );

  useEffect(() => {
    if (!hasLoaded) return;
    debouncedSave(storageKeys.TEMPLATES, templates, 500);
  }, [debouncedSave, hasLoaded, storageKeys.TEMPLATES, templates]);

  useEffect(() => {
    if (!hasLoaded) return;
    debouncedSave(storageKeys.PROJECTS, projects, 500);
  }, [debouncedSave, hasLoaded, projects, storageKeys.PROJECTS]);

  useEffect(() => {
    if (!hasLoaded) return;
    debouncedSave(storageKeys.SETTINGS, settings, 800);
  }, [debouncedSave, hasLoaded, settings, storageKeys.SETTINGS]);

  useEffect(
    () => () => {
      Object.values(persistTimers.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer as ReturnType<typeof setTimeout>);
        }
      });
    },
    []
  );
};

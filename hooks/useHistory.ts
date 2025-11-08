import { useState, useCallback } from 'react';

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const useHistory = <T>(initialState: T) => {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    const newPast = history.past.slice(0, history.past.length - 1);
    const newPresent = history.past[history.past.length - 1];
    const newFuture = [history.present, ...history.future];

    setHistory({
      past: newPast,
      present: newPresent,
      future: newFuture,
    });
  }, [canUndo, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const newPast = [...history.past, history.present];
    const newPresent = history.future[0];
    const newFuture = history.future.slice(1);

    setHistory({
      past: newPast,
      present: newPresent,
      future: newFuture,
    });
  }, [canRedo, history]);

  const setState = useCallback((newState: T, overwrite: boolean = false) => {
    if (overwrite) {
       setHistory({
            past: [],
            present: newState,
            future: [],
        });
    } else {
        setHistory(currentHistory => {
            // Avoid adding duplicate states to history
            if (JSON.stringify(newState) === JSON.stringify(currentHistory.present)) {
                return currentHistory;
            }
            return {
                past: [...currentHistory.past, currentHistory.present],
                present: newState,
                future: [],
            };
        });
    }
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
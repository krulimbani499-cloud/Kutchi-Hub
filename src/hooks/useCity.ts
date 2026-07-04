import { useEffect, useState, useCallback } from "react";

const KEY = "kutchi-hub:city";
const EVT = "kutchi-hub:city-changed";

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function useCity() {
  const [city, setCityState] = useState<string | null>(null);

  useEffect(() => {
    setCityState(read());
    const onChange = () => setCityState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setCity = useCallback((next: string | null) => {
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
    setCityState(next);
  }, []);

  return { city, setCity };
}
import { useState, useEffect, useRef } from "react";

export function useEventSource<T>(url: string) {
  console.log("useEventSource hook called with URL:", url);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new connection
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        console.log("SSE message received:", event.data);
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (err) {
        console.error("Error parsing SSE data:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      setError(err instanceof Error ? err : new Error("EventSource failed"));

      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = new EventSource(url);
        }
      }, 5000);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url]);

  return { data, error };
}

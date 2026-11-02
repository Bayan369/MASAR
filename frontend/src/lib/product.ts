import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
export interface Department {
  id: string;
  name: string;
  description: string | null;
}
export interface Document {
  id: string;
  title: string;
  status: string;
  visibility: string;
  department_id: string | null;
  original_name: string;
  mime_type: string;
  processing_error: string | null;
  uploaded_at: string | null;
}
export interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: {
    id: string;
    document_id: string;
    title: string;
    section: string;
    quote: string;
    excerpt: string;
  }[];
  turn_id: string;
}
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "تعذّر تحميل البيانات.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return {
    data,
    error,
    loading,
    reload: useCallback(() => setVersion((n) => n + 1), []),
  };
}

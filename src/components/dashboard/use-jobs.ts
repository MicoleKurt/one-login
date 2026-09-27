"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/lib/money";
import type { NewJob } from "./job-sheet";

type SaveResult = "saved" | "offline" | "rejected";

const byNewest = (a: Job, b: Job) => Date.parse(b.done_at) - Date.parse(a.done_at);

/**
 * Money in, with no waiting:
 * - optimistic: the number moves the instant you tap
 * - offline-first: no signal on site? the job waits on the phone and syncs later
 * - realtime: log a job on one device, every other device updates
 */
export function useJobs(userId: string, monthStart: string, initial: Job[]) {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>(initial);
  const removed = useRef(new Set<string>());
  const queueKey = `one-login:pending:${userId}`;

  const readQueue = useCallback((): Job[] => {
    try {
      return JSON.parse(localStorage.getItem(queueKey) ?? "[]");
    } catch {
      return [];
    }
  }, [queueKey]);

  const writeQueue = useCallback(
    (queue: Job[]) => {
      try {
        if (queue.length) localStorage.setItem(queueKey, JSON.stringify(queue));
        else localStorage.removeItem(queueKey);
      } catch {
        // Private mode / storage full: the job still lives in memory for this session.
      }
    },
    [queueKey],
  );

  const save = useCallback(
    async (job: Job): Promise<SaveResult> => {
      const { error } = await supabase.from("jobs").insert({
        id: job.id,
        customer: job.customer,
        description: job.description,
        amount_cents: job.amount_cents,
        done_at: job.done_at,
      });
      if (!error || error.code === "23505") return "saved"; // 23505: already landed on a retry
      if (!navigator.onLine || /fetch|network|load failed|timeout/i.test(error.message))
        return "offline";
      return "rejected";
    },
    [supabase],
  );

  const markSaved = useCallback((id: string) => {
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, pending: false } : j)));
  }, []);

  const flush = useCallback(async () => {
    for (const job of readQueue()) {
      const result = await save(job);
      if (result === "offline") return;
      writeQueue(readQueue().filter((j) => j.id !== job.id));
      if (result === "saved") {
        if (removed.current.has(job.id)) await supabase.from("jobs").delete().eq("id", job.id);
        else markSaved(job.id);
      } else {
        setJobs((list) => list.filter((j) => j.id !== job.id));
      }
    }
  }, [readQueue, writeQueue, save, markSaved, supabase]);

  // Restore anything logged without signal last time, then try to send it.
  useEffect(() => {
    const queued = readQueue();
    if (queued.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from device storage
      setJobs((list) => {
        const known = new Set(list.map((j) => j.id));
        return [
          ...list,
          ...queued.filter((j) => !known.has(j.id)).map((j) => ({ ...j, pending: true })),
        ].sort(byNewest);
      });
      void flush();
    }
    const retry = () => void flush();
    window.addEventListener("online", retry);
    const timer = setInterval(() => {
      if (navigator.onLine && readQueue().length) retry();
    }, 15_000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [flush, readQueue]);

  // Live across devices.
  useEffect(() => {
    let cancelled = false;
    const channel = supabase
      .channel(`jobs:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Job;
          if (removed.current.has(row.id) || Date.parse(row.done_at) < Date.parse(monthStart))
            return;
          setJobs((list) =>
            list.some((j) => j.id === row.id)
              ? list.map((j) => (j.id === row.id ? { ...j, pending: false } : j))
              : [row, ...list].sort(byNewest),
          );
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "jobs" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setJobs((list) => list.filter((j) => j.id !== id));
      });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, monthStart]);

  /** Returns the job immediately (for Undo) and a promise for the server's answer. */
  const add = useCallback(
    (input: NewJob): { job: Job; saved: Promise<SaveResult> } => {
      const job: Job = {
        id: crypto.randomUUID(),
        ...input,
        done_at: new Date().toISOString(),
        pending: true,
      };
      setJobs((list) => [job, ...list]);
      writeQueue([...readQueue(), job]);

      const saved = save(job).then(async (result) => {
        if (result === "offline") return result;
        writeQueue(readQueue().filter((j) => j.id !== job.id));
        if (result === "saved") {
          if (removed.current.has(job.id)) await supabase.from("jobs").delete().eq("id", job.id);
          else markSaved(job.id);
        } else {
          setJobs((list) => list.filter((j) => j.id !== job.id));
        }
        return result;
      });

      return { job, saved };
    },
    [save, readQueue, writeQueue, markSaved, supabase],
  );

  const undo = useCallback(
    async (job: Job) => {
      removed.current.add(job.id);
      setJobs((list) => list.filter((j) => j.id !== job.id));
      writeQueue(readQueue().filter((j) => j.id !== job.id));
      const { error } = await supabase.from("jobs").delete().eq("id", job.id);
      if (error && navigator.onLine) {
        removed.current.delete(job.id);
        setJobs((list) => [job, ...list].sort(byNewest));
        return false;
      }
      return true;
    },
    [supabase, readQueue, writeQueue],
  );

  return { jobs, add, undo };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/lib/money";
import type { NewJob } from "./job-sheet";

type SaveResult = "saved" | "offline" | "rejected";
export type UndoResult = "undone" | "locked" | "failed";

const QUEUE_PREFIX = "one-login:pending:";
const byNewest = (a: Job, b: Job) => Date.parse(b.done_at) - Date.parse(a.done_at);

/** Wipe anything this app kept on the device - called on sign out (shared phones, lost phones). */
export function clearDeviceData() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(QUEUE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing was kept.
  }
}

/**
 * Money in, with no waiting:
 * - optimistic: the number moves the instant you tap
 * - offline-first: no signal on site? the job waits on the phone and syncs later
 * - realtime: log a job on one device, every other device in the same business updates
 * Jobs are never deleted. Undo voids the entry, and the database only allows that for the
 * person who logged it, within 15 minutes.
 */
export function useJobs(userId: string, businessId: string, monthStart: string, initial: Job[]) {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>(initial);
  const undone = useRef(new Set<string>());
  const queueKey = `${QUEUE_PREFIX}${userId}`;

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

  const voidJob = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from("jobs")
        .update({ voided_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) return "failed" as const;
      return data.length ? ("undone" as const) : ("locked" as const);
    },
    [supabase],
  );

  const save = useCallback(
    async (job: Job): Promise<SaveResult> => {
      // Only the job's own fields are sent. The database stamps the business, the author
      // and the time itself, and refuses any other column outright.
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

  const settle = useCallback(
    async (job: Job, result: SaveResult) => {
      if (result === "offline") return;
      writeQueue(readQueue().filter((j) => j.id !== job.id));
      if (result === "rejected") {
        setJobs((list) => list.filter((j) => j.id !== job.id));
      } else if (undone.current.has(job.id)) {
        await voidJob(job.id); // undone while it was still in flight
      } else {
        setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, pending: false } : j)));
      }
    },
    [readQueue, writeQueue, voidJob],
  );

  const flush = useCallback(async () => {
    for (const job of readQueue()) {
      const result = await save(job);
      if (result === "offline") return;
      await settle(job, result);
    }
  }, [readQueue, save, settle]);

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

  // Live across this business's devices. RLS is applied to every event, so a filter
  // pointed at another business's id simply receives nothing.
  useEffect(() => {
    let cancelled = false;
    const filter = `business_id=eq.${businessId}`;
    const upsert = (row: Job & { voided_at: string | null }) => {
      if (row.voided_at || undone.current.has(row.id)) {
        setJobs((list) => list.filter((j) => j.id !== row.id));
        return;
      }
      if (Date.parse(row.done_at) < Date.parse(monthStart)) return;
      setJobs((list) =>
        list.some((j) => j.id === row.id)
          ? list.map((j) => (j.id === row.id ? { ...j, pending: false } : j))
          : [row, ...list].sort(byNewest),
      );
    };

    const channel = supabase
      .channel(`jobs:${businessId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs", filter }, (p) =>
        upsert(p.new as Job & { voided_at: string | null }),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter }, (p) =>
        upsert(p.new as Job & { voided_at: string | null }),
      );

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, businessId, monthStart]);

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
        await settle(job, result);
        return result;
      });

      return { job, saved };
    },
    [save, settle, readQueue, writeQueue],
  );

  const undo = useCallback(
    async (job: Job): Promise<UndoResult> => {
      undone.current.add(job.id);
      setJobs((list) => list.filter((j) => j.id !== job.id));

      const queued = readQueue();
      if (queued.some((j) => j.id === job.id)) {
        // Never reached the server: dropping it from the phone is the whole undo.
        writeQueue(queued.filter((j) => j.id !== job.id));
        return "undone";
      }

      const result = await voidJob(job.id);
      if (result !== "undone") {
        undone.current.delete(job.id);
        setJobs((list) => [job, ...list].sort(byNewest));
      }
      return result;
    },
    [readQueue, writeQueue, voidJob],
  );

  return { jobs, add, undo };
}

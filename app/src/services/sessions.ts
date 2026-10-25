// All session writes go through here so image files and records stay consistent.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { EventKind, FixSession, ImageSource, ProblemCategory, SessionImage } from "../core/types.ts";
import { isOpen, searchText } from "../core/session.ts";
import { t } from "../i18n/index.ts";
import { deleteAllImages, removeUnreferenced, storeImage } from "./images.ts";
import { createStore, useStore } from "./store.ts";

export type Capture = { id: string; uri: string; width: number; height: number; source: ImageSource };

const KEY = "sessions.v1";
export const sessionsStore = createStore<FixSession[]>([]);
export const useSessions = () => useStore(sessionsStore);
export const useSession = (id: string) => useStore(sessionsStore).find((s) => s.id === id) ?? null;

let saveQueue = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(sessionsStore.get());
  saveQueue = saveQueue.then(() => AsyncStorage.setItem(KEY, snapshot)).catch(() => {});
}

export async function loadSessions() {
  const raw = await AsyncStorage.getItem(KEY);
  sessionsStore.set(raw ? (JSON.parse(raw) as FixSession[]) : []);
}

export const getSession = (id: string) => sessionsStore.get().find((s) => s.id === id) ?? null;

/** Applies a change to one session, bumps updatedAt and saves. */
export function updateSession(id: string, change: (s: FixSession) => FixSession) {
  sessionsStore.set((all) => all.map((s) => (s.id === id ? { ...change(s), updatedAt: Date.now() } : s)));
  persist();
}

export function logEvent(s: FixSession, kind: EventKind, text: string, stepId?: string): FixSession {
  return { ...s, events: [...s.events, { id: Crypto.randomUUID(), date: Date.now(), kind, text, stepId }] };
}

async function toImages(captures: Capture[]): Promise<SessionImage[]> {
  const images: SessionImage[] = [];
  for (const [i, c] of captures.entries()) {
    const stored = await storeImage(c.uri, c.width, c.height);
    images.push({
      id: Crypto.randomUUID(),
      createdAt: Date.now() + i,
      uri: stored.uri,
      hash: stored.hash,
      width: stored.width,
      height: stored.height,
      source: c.source,
      blocks: null,
    });
  }
  return images;
}

export async function createSession(captures: Capture[], description: string, category: ProblemCategory | null) {
  const images = await toImages(captures);
  const trimmed = description.trim();
  const now = Date.now();
  let session: FixSession = {
    id: Crypto.randomUUID(),
    title: trimmed ? trimmed.slice(0, 48) : t("New problem"),
    createdAt: now,
    updatedAt: now,
    status: "pendingAnalysis",
    category,
    description,
    images,
    revisions: [],
    events: [],
    stepStates: {},
    answers: [],
    outcomeNote: null,
  };
  session = images.length
    ? logEvent(session, "captured", `${images.length} × ${t("Photo")}`)
    : logEvent(session, "captured", t("Problem described without a photo"));
  sessionsStore.set((all) => [session, ...all]);
  persist();
  return session;
}

export async function addImages(sessionId: string, captures: Capture[], note: string) {
  const images = await toImages(captures);
  updateSession(sessionId, (s) => {
    let next = { ...s, images: [...s.images, ...images] };
    if (note.trim()) next = logEvent(next, "note", note.trim());
    return logEvent(next, "photoAdded", t("New observation added"));
  });
  return images;
}

function referencedHashes() {
  return new Set(sessionsStore.get().flatMap((s) => s.images.map((i) => i.hash)));
}

export function deleteSession(id: string) {
  const hashes = getSession(id)?.images.map((i) => i.hash) ?? [];
  sessionsStore.set((all) => all.filter((s) => s.id !== id));
  persist();
  removeUnreferenced(hashes, referencedHashes());
}

/** Removes the photos but keeps text, steps and history. */
export function deletePhotos(id: string) {
  const hashes = getSession(id)?.images.map((i) => i.hash) ?? [];
  updateSession(id, (s) => logEvent({ ...s, images: [] }, "note", t("Photos deleted to save space")));
  removeUnreferenced(hashes, referencedHashes());
}

export async function deleteEverything() {
  sessionsStore.set([]);
  await AsyncStorage.removeItem(KEY);
  deleteAllImages();
}

/** "Delete photos of solved sessions after N days". */
export function applyRetention(days: number) {
  if (days <= 0) return;
  const cutoff = Date.now() - days * 86_400_000;
  for (const s of sessionsStore.get()) {
    if (s.status === "solved" && s.updatedAt < cutoff && s.images.length) deletePhotos(s.id);
  }
}

export function refreshedSearch(s: FixSession) {
  return searchText(s);
}

export const openSessions = (all: FixSession[]) => all.filter((s) => isOpen(s.status));

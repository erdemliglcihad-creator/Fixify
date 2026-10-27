// User preferences. The app token goes to the Keychain (expo-secure-store); the rest to AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createStore, useStore } from "./store.ts";

export type Appearance = "system" | "light" | "dark";
/** cloud = Fixify Cloud (free, works for everyone), proxy = your own server (server/), off = no AI. */
export type Provider = "cloud" | "proxy" | "off";

export type Settings = {
  appearance: Appearance;
  provider: Provider;
  serverURL: string;
  appToken: string;
  /** Explicit consent to send photos and text to the AI service. */
  consent: boolean;
  reminders: boolean;
  seenCameraTip: boolean;
  /** The welcome screen (features, daily limits, privacy) was shown once. */
  seenWelcome: boolean;
  autoDeleteDays: number;
};

const DEFAULTS: Settings = {
  appearance: "system",
  provider: "cloud",
  serverURL: "",
  appToken: "",
  consent: false,
  reminders: false,
  seenCameraTip: false,
  seenWelcome: false,
  autoDeleteDays: 0,
};

const KEY = "settings.v1";
const TOKEN_KEY = "fixify.appToken";
const DEVICE_KEY = "fixify.deviceId";

/** Address of the deployed Fixify Cloud worker (worker/). Set in app/.env as EXPO_PUBLIC_CLOUD_URL; inlined at build time. */
const RAW_CLOUD_URL = (process.env.EXPO_PUBLIC_CLOUD_URL ?? "").replace(/\/+$/, "");
// On a phone, "localhost" is the phone itself, so a local test address must never be used there.
export const CLOUD_URL: string = Platform.OS !== "web" && /\/\/(localhost|127\.0\.0\.1)/.test(RAW_CLOUD_URL) ? "" : RAW_CLOUD_URL;

export const settingsStore = createStore<Settings>(DEFAULTS);
export const useSettings = () => useStore(settingsStore);

/** Random id for this installation, used only for the per-device daily limit. Not linked to the person. */
export let deviceId = "";

const secure = {
  get: (k: string) => (Platform.OS === "web" ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === "web" ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
};

export async function loadSettings() {
  const [raw, token, device] = await Promise.all([
    AsyncStorage.getItem(KEY),
    secure.get(TOKEN_KEY).catch(() => null),
    secure.get(DEVICE_KEY).catch(() => null),
  ]);
  const stored = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  // Older installs defaulted to "proxy" without an address; they get the cloud now.
  if (stored.provider === "proxy" && !stored.serverURL?.trim()) stored.provider = "cloud";
  settingsStore.set({ ...DEFAULTS, ...stored, appToken: token ?? "" });
  deviceId = device ?? Crypto.randomUUID();
  if (!device) secure.set(DEVICE_KEY, deviceId).catch(() => {});
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...settingsStore.get(), ...patch };
  settingsStore.set(next);
  const { appToken, ...rest } = next;
  AsyncStorage.setItem(KEY, JSON.stringify(rest));
  if ("appToken" in patch) secure.set(TOKEN_KEY, appToken);
}

function normalizeUrl(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;
  if (!text.includes("://")) text = `http://${text}`;
  text = text.replace(/\/+$/, "");
  try {
    return new URL(text).host ? text : null;
  } catch {
    return null;
  }
}

/** Base URL of the active AI service, or null if none is usable. */
export function serverBase(s: Settings): string | null {
  if (s.provider === "cloud") return CLOUD_URL || null;
  if (s.provider === "proxy") return normalizeUrl(s.serverURL);
  return null;
}

export const isServerConfigured = (s: Settings) =>
  s.provider === "cloud" ? CLOUD_URL !== "" : s.provider === "proxy" && normalizeUrl(s.serverURL) !== null && s.appToken.trim() !== "";

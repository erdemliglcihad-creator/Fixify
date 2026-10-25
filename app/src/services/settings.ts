// User preferences. The app token goes to the Keychain (expo-secure-store); the rest to AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createStore, useStore } from "./store.ts";

export type Appearance = "system" | "light" | "dark";
export type Provider = "proxy" | "off";

export type Settings = {
  appearance: Appearance;
  provider: Provider;
  serverURL: string;
  appToken: string;
  /** Explicit consent to send photos and text to the configured server. */
  consent: boolean;
  reminders: boolean;
  seenCameraTip: boolean;
  autoDeleteDays: number;
};

const DEFAULTS: Settings = {
  appearance: "system",
  provider: "proxy",
  serverURL: "",
  appToken: "",
  consent: false,
  reminders: false,
  seenCameraTip: false,
  autoDeleteDays: 0,
};

const KEY = "settings.v1";
const TOKEN_KEY = "fixify.appToken";

export const settingsStore = createStore<Settings>(DEFAULTS);
export const useSettings = () => useStore(settingsStore);

const secure = {
  get: () => (Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY)),
  set: (v: string) => (Platform.OS === "web" ? AsyncStorage.setItem(TOKEN_KEY, v) : SecureStore.setItemAsync(TOKEN_KEY, v)),
};

export async function loadSettings() {
  const [raw, token] = await Promise.all([AsyncStorage.getItem(KEY), secure.get().catch(() => null)]);
  const stored = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  settingsStore.set({ ...DEFAULTS, ...stored, appToken: token ?? "" });
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...settingsStore.get(), ...patch };
  settingsStore.set(next);
  const { appToken, ...rest } = next;
  AsyncStorage.setItem(KEY, JSON.stringify(rest));
  if ("appToken" in patch) secure.set(appToken);
}

/** http://host:port without trailing slash, or null if unusable. */
export function serverBase(s: Settings): string | null {
  let text = s.serverURL.trim();
  if (!text) return null;
  if (!text.includes("://")) text = `http://${text}`;
  text = text.replace(/\/+$/, "");
  try {
    return new URL(text).host ? text : null;
  } catch {
    return null;
  }
}

export const isServerConfigured = (s: Settings) => s.provider === "proxy" && serverBase(s) !== null && s.appToken.trim() !== "";

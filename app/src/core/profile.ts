// Answers from the first-launch questions. Kept on the iPhone; a short English summary goes along with
// FixVoice questions so answers fit the person (never the raw answers, never anything else).

export const WHY = ["broken", "understand", "family", "work", "curious"] as const;
export const TOPICS = ["computer", "network", "phone", "appliance", "tv", "home", "car"] as const;
export const DEVICES = ["iphone", "android", "mac", "windows", "ipad", "printer", "smarttv", "console", "smarthome"] as const;
export const HELP = ["voice", "camera", "read"] as const;
export const SOURCES = ["tiktok", "instagram", "youtube", "friends", "appstore", "other"] as const;

export type Profile = {
  name: string;
  why: (typeof WHY)[number] | null;
  topics: (typeof TOPICS)[number][];
  devices: (typeof DEVICES)[number][];
  help: (typeof HELP)[number] | null;
  source: (typeof SOURCES)[number] | null;
};

export const emptyProfile = (): Profile => ({ name: "", why: null, topics: [], devices: [], help: null, source: null });

const WHY_TEXT: Record<Profile["why"] & string, string> = {
  broken: "came because something is broken right now",
  understand: "wants to understand technology better",
  family: "often helps family and friends with technology",
  work: "uses it for work",
  curious: "is curious what the app can do",
};

const TOPIC_TEXT: Record<Profile["topics"][number], string> = {
  computer: "computers",
  network: "Wi-Fi and internet",
  phone: "phones and tablets",
  appliance: "household appliances",
  tv: "TV and streaming",
  home: "home and tools",
  car: "cars and bikes",
};

const DEVICE_TEXT: Record<Profile["devices"][number], string> = {
  iphone: "iPhone",
  android: "Android phone",
  mac: "Mac",
  windows: "Windows PC",
  ipad: "iPad",
  printer: "printer",
  smarttv: "smart TV",
  console: "game console",
  smarthome: "smart home devices",
};

const HELP_TEXT: Record<Profile["help"] & string, string> = {
  voice: "prefers talking it through",
  camera: "prefers showing the problem with the camera",
  read: "prefers reading short written steps",
};

/** A compact description for the AI, or null when nothing useful was answered. The source is not included. */
export function profileSummary(p: Profile | null): string | null {
  if (!p) return null;
  const parts = [
    p.name.trim() ? `Their name is ${p.name.trim().slice(0, 40)}; you may use it now and then.` : null,
    p.why ? `The user ${WHY_TEXT[p.why]}.` : null,
    p.topics.length ? `They mostly fix ${p.topics.map((t) => TOPIC_TEXT[t]).join(", ")}.` : null,
    p.devices.length ? `Their devices: ${p.devices.map((d) => DEVICE_TEXT[d]).join(", ")}.` : null,
    p.help ? `They ${HELP_TEXT[p.help]}.` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** First name for greetings, or null. */
export const firstName = (p: Profile | null) => p?.name.trim().split(/\s+/)[0]?.slice(0, 24) || null;

export type SteamIdentity =
  | {
      steamid: string;
    }
  | {
      vanity: string;
    };

const STEAMID64 = /^7656119\d{10}$/;
const PROFILE_URL =
  /steamcommunity\.com\/(?:profiles\/(\d{17})|id\/([^/?#]+))/i;

export function parseSteamInput(value: string): SteamIdentity | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fromUrl = trimmed.match(PROFILE_URL);
  if (fromUrl?.[1] && STEAMID64.test(fromUrl[1])) {
    return { steamid: fromUrl[1] };
  }

  if (fromUrl?.[2]) {
    const vanity = decodeURIComponent(fromUrl[2]).trim();
    return vanity ? { vanity } : null;
  }

  return STEAMID64.test(trimmed) ? { steamid: trimmed } : null;
}

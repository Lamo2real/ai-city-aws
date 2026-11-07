// Runtime settings, served next to the app as /config.json by the deploy (Terraform outputs).
// Nothing secret lives here: Cognito client IDs and endpoints are public by design.
export interface AppConfig {
  region: string;
  apiUrl: string;
  wsUrl: string;
  cognitoDomain: string;
  clientId: string;
  userPoolId: string;
  identityPoolId: string;
  redirectUri: string;
  pollyVoice: string;
  transcribeVocabulary: string;
  /** The isolated origin that serves the apps the city builds (docs/APPS.md). Empty: no app is shown. */
  appsUrl?: string;
}

let cached: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  const r = await fetch("/config.json", { cache: "no-store" });
  if (!r.ok) throw new Error("The app's settings could not be loaded.");
  const c = (await r.json()) as AppConfig;
  cached = { ...c, redirectUri: c.redirectUri || `${location.origin}/` };
  return cached;
}
export const config = (): AppConfig => {
  if (!cached) throw new Error("config not loaded");
  return cached;
};

/** An environment variable, or undefined when it's missing or blank (.env.example leaves many empty) */
export function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export const siteUrl = () => env("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

// app/sitemap.ts
import { MetadataRoute } from "next";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; // Added a fallback for appUrl

  // Initialize with static routes
  const staticRoutes = [
    "",
    "/home",
    "/about",
    "/privacy",
    "/terms",
    "/legal",
    "/developers",
    "/upload",
    "/download",
    "/docs",
    "/docs/api",
    "/docs/faq",
    "/docs/getting-started",
    "/docs/local-usage",
    "/docs/tutorials",
  ].map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: new Date().toISOString(),
  }));

  return staticRoutes;
}

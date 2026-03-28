import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://hishamnimri.com",
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: "https://hishamnimri.com/about",
      lastModified: new Date(),
      priority: 0.8,
    },
    {
      url: "https://hishamnimri.com/blog",
      lastModified: new Date(),
      priority: 0.7,
    },
    {
      url: "https://hishamnimri.com/blog/elections-behind-the-lens",
      lastModified: new Date("2024-11-05"),
      priority: 0.6,
    },
    {
      url: "https://hishamnimri.com/us-2024-elections",
      lastModified: new Date("2024-11-05"),
      priority: 0.6,
    },
  ];
}

import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  // 末尾の「/」を消して記述します
  const baseUrl = 'https://ana-mileage-app.vercel.app';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
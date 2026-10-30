import { db } from '@/db';
import { siteSettings } from '@/db/schema';
export * from './site-content-shared';
import { mergeSiteContent, DEFAULT_SITE_CONTENT, type SiteContent } from './site-content-shared';
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const rows = await db.select().from(siteSettings);
    const main = rows.find(r => r.key === 'main');
    return mergeSiteContent(main?.value as Record<string, unknown>);
  } catch { return DEFAULT_SITE_CONTENT; } // website must still render before migration is applied
}

import type { APIRoute } from 'astro';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type SitemapUrl = {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: string;
};

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function toXml(urls: SitemapUrl[]): string {
    const body = urls
        .map((url) => {
            const fields = [
                `<loc>${escapeXml(url.loc)}</loc>`,
                url.lastmod ? `<lastmod>${escapeXml(url.lastmod)}</lastmod>` : '',
                url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : '',
                url.priority ? `<priority>${url.priority}</priority>` : ''
            ]
                .filter(Boolean)
                .join('');

            return `<url>${fields}</url>`;
        })
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export const GET: APIRoute = async ({ site }) => {
    const base = (site?.toString() || 'https://nicovantage.victoriafp.online').replace(/\/$/, '');
    const now = new Date().toISOString();

    const urls: SitemapUrl[] = [
        { loc: `${base}/`, changefreq: 'daily', priority: '1.0', lastmod: now },
        { loc: `${base}/productos`, changefreq: 'daily', priority: '0.9', lastmod: now },
        { loc: `${base}/sobre-nosotros`, changefreq: 'monthly', priority: '0.5', lastmod: now },
        { loc: `${base}/envios-devoluciones`, changefreq: 'monthly', priority: '0.5', lastmod: now },
        { loc: `${base}/guia-tallas`, changefreq: 'monthly', priority: '0.5', lastmod: now },
        { loc: `${base}/privacidad`, changefreq: 'yearly', priority: '0.3', lastmod: now },
        { loc: `${base}/terminos`, changefreq: 'yearly', priority: '0.3', lastmod: now }
    ];

    if (isSupabaseConfigured) {
        try {
            const [{ data: products }, { data: categories }] = await Promise.all([
                supabase.from('products').select('slug, updated_at'),
                supabase.from('categories').select('slug, created_at')
            ]);

            for (const product of products || []) {
                urls.push({
                    loc: `${base}/productos/${product.slug}`,
                    changefreq: 'weekly',
                    priority: '0.8',
                    lastmod: product.updated_at || now
                });
            }

            for (const category of categories || []) {
                urls.push({
                    loc: `${base}/categoria/${category.slug}`,
                    changefreq: 'weekly',
                    priority: '0.7',
                    lastmod: category.created_at || now
                });
            }
        } catch (error) {
            console.error('Failed to enrich sitemap from Supabase:', error);
        }
    }

    const xml = toXml(urls);

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};

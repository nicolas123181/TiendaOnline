// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
// En Astro 5, usamos 'server' con prerender por defecto en las páginas estáticas
export default defineConfig({
    site:'https://nicovantage.victoriafp.online',
    output: 'server',
    security: {
        checkOrigin: false
    },
    adapter: node({
        mode: 'standalone',
    }),
    integrations: [
        react()
    ],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            exclude: ['@nanostores/react']
        }
    }
});

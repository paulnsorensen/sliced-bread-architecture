import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { cheeselordTheme } from '@cheeselord/design/starlight'

export default defineConfig({
  site: 'https://cheeselord.dev',
  base: '/sliced-bread-architecture',
  integrations: [
    starlight({
      title: 'Sliced Bread',
      description:
        'Vertical-slice architecture with organic growth: structure emerges from pressure, and every dependency arrow points in a permitted direction.',
      plugins: [cheeselordTheme({ flavor: 'sliced-bread' })],
      components: {
        SiteTitle: './src/components/Brand.astro',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/paulnsorensen/sliced-bread-architecture',
        },
      ],
      sidebar: [
        {
          label: 'Reference',
          items: [{ label: 'The Architecture', slug: 'reference/sliced-bread' }],
        },
        {
          label: 'Agent Skills',
          items: [{ label: 'Overview', slug: 'skills' }],
        },
      ],
    }),
  ],
})

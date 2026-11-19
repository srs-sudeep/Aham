import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Aham',
  tagline: 'Copier-driven platform template for FastAPI backends and Vite SPAs',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://aham.example.com',
  baseUrl: '/',

  organizationName: 'aham',
  projectName: 'aham',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Aham',
      logo: {
        alt: 'Aham',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'templateSidebar',
          position: 'left',
          label: 'Template',
        },
        {
          type: 'docSidebar',
          sidebarId: 'backendSidebar',
          position: 'left',
          label: 'Backend',
        },
        {
          type: 'docSidebar',
          sidebarId: 'frontendSidebar',
          position: 'left',
          label: 'Frontend',
        },
        {
          href: 'https://github.com',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/docs/intro'},
            {label: 'Architecture', to: '/docs/getting-started/architecture'},
            {label: 'Getting started', to: '/docs/getting-started/overview'},
            {label: 'Template', to: '/docs/template/overview'},
          ],
        },
        {
          title: 'Stacks',
          items: [
            {label: 'Backend API reference', to: '/docs/backend/api-reference'},
            {label: 'Frontend modules', to: '/docs/frontend/modules'},
            {label: 'SaaS auth', to: '/docs/frontend/auth'},
            {label: 'Configuration', to: '/docs/backend/configuration'},
          ],
        },
        {
          title: 'Repo',
          items: [
            {label: 'Meta-repo workflow', to: '/docs/getting-started/meta-repo'},
            {label: 'Example drift', to: '/docs/template/example-drift'},
            {label: 'HANDOFF', to: '/docs/template/handoff'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Aham. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'toml', 'docker', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

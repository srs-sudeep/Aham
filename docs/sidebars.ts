import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: [
        'getting-started/overview',
        'getting-started/generate-project',
        'getting-started/local-dev',
      ],
    },
  ],
  templateSidebar: [
    {
      type: 'category',
      label: 'Template',
      collapsed: false,
      items: [
        'template/overview',
        'template/copier-options',
        'template/generation-workflow',
        'template/updating-projects',
        'template/handoff',
      ],
    },
  ],
  backendSidebar: [
    {
      type: 'category',
      label: 'Backend',
      collapsed: false,
      items: [
        'backend/overview',
        'backend/architecture',
        'backend/layouts',
        'backend/platform-kit',
        'backend/modules',
        'backend/saas-spine',
        'backend/messaging',
        'backend/dx-cli',
        'backend/testing-ci',
        'backend/examples',
      ],
    },
  ],
  frontendSidebar: [
    {
      type: 'category',
      label: 'Frontend',
      collapsed: false,
      items: [
        'frontend/overview',
        'frontend/ui-kit',
        'frontend/features',
        'frontend/routing-auth',
        'frontend/theming-i18n',
        'frontend/dx-check',
        'frontend/connecting-api',
      ],
    },
  ],
};

export default sidebars;

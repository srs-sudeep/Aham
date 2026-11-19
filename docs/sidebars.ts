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
        'getting-started/meta-repo',
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
        'template/example-drift',
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
        'backend/api-reference',
        'backend/configuration',
        'backend/permissions',
        'backend/data-model',
        'backend/saas-spine',
        'backend/tenancy',
        'backend/messaging',
        'backend/dx-cli',
        'backend/dx-rules',
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
        'frontend/modules',
        'frontend/ui-kit',
        'frontend/auth',
        'frontend/routing',
        'frontend/catalog',
        'frontend/connecting-api',
        'frontend/mocks',
        'frontend/theming-i18n',
        'frontend/dx-check',
        'frontend/testing',
      ],
    },
  ],
};

export default sidebars;

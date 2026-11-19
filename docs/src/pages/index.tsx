import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

type Feature = {
  title: string;
  description: string;
  to: string;
};

const features: Feature[] = [
  {
    title: 'Template',
    description:
      'Copier source of truth: stack, layouts, SaaS profile, auth_mode, and example drift gates.',
    to: '/docs/template/overview',
  },
  {
    title: 'Backend',
    description:
      'FastAPI + platform-kit: full API catalog, env map, TEN001 tenancy, Kafka outbox, dx rules.',
    to: '/docs/backend/overview',
  },
  {
    title: 'Frontend',
    description:
      'Vite ERP SPA: modules→features, SaaS auth, catalog CRUD, MSW, FE-* checks, ui-kit exports.',
    to: '/docs/frontend/overview',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--aham', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Read the docs
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/local-dev">
            Run locally
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeatureGrid() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="aham-feature-grid">
          {features.map((feature) => (
            <Link key={feature.title} to={feature.to} className="aham-feature-card">
              <Heading as="h3">{feature.title}</Heading>
              <p>{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} docs`}
      description="Technical documentation for the Aham Copier template, FastAPI platform-kit, and Vite ui-kit SPA.">
      <HomepageHeader />
      <main>
        <FeatureGrid />
      </main>
    </Layout>
  );
}

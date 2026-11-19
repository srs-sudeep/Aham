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
      'One Copier source that generates backend or frontend projects with the right layout, messaging, and tooling.',
    to: '/docs/template/overview',
  },
  {
    title: 'Backend',
    description:
      'FastAPI + platform-kit: modular monoliths, microservices, Kafka, SaaS spine, and enforced module layering.',
    to: '/docs/backend/overview',
  },
  {
    title: 'Frontend',
    description:
      'Vite + React + ui-kit: fixed core routes, feature folders, theme/i18n, and dx check across the SPA.',
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
            to="/docs/getting-started/generate-project">
            Generate a project
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
      description="Platform documentation for Aham template, backend, and frontend stacks.">
      <HomepageHeader />
      <main>
        <FeatureGrid />
      </main>
    </Layout>
  );
}

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import diseaseMetadata from '@/data/disease-metadata.json';

/**
 * /disease/[key] — Disease deep-link page.
 *
 * In **dev**, this page actually serves: it sets the SPA hash and redirects
 * into the main HumanOS app, so a path URL like /humanos/disease/nafld/
 * works during local development without needing the production build's
 * generated landing pages.
 *
 * In **production static export**, Next.js generates an HTML file at this
 * path during `next build`. The build pipeline (scripts/build-static.mjs →
 * scripts/generate-share-pages.mjs) then OVERWRITES that file with a
 * crawler-friendly landing page that includes per-disease OG/Twitter meta
 * tags and a 1200x630 share image. The user-facing redirect is the same in
 * both cases.
 */

interface Props {
  diseaseKey: string;
  label: string;
  description: string;
}

interface DiseaseRecord {
  label: string;
  shortLabel: string;
  efoId: string;
  color: string;
  primaryOrgan: string;
  description: string;
}

export default function DiseaseDeepLink({ diseaseKey, label, description }: Props) {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
    const target = `${basePath}/#view=galaxy&disease=${diseaseKey}`;
    window.location.replace(target);
  }, [router.isReady, diseaseKey]);

  return (
    <>
      <Head>
        <title>{label} · Human OS</title>
        <meta name="description" content={description} />
      </Head>
      <main style={{ background: '#070b20', color: 'rgba(255,255,255,0.65)', minHeight: '100vh', padding: 48, fontFamily: '-apple-system, system-ui, sans-serif' }}>
        <h1 style={{ fontWeight: 500, letterSpacing: '1px', marginBottom: 8 }}>{label}</h1>
        <p style={{ lineHeight: 1.5, maxWidth: 640 }}>{description}</p>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 16 }}>
          Loading the Human OS galaxy view…
        </p>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const data = (diseaseMetadata as { diseases: Record<string, DiseaseRecord> }).diseases;
  return {
    paths: Object.keys(data).map((key) => ({ params: { key } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const key = params?.key as string;
  const data = (diseaseMetadata as { diseases: Record<string, DiseaseRecord> }).diseases;
  const d = data[key];
  if (!d) return { notFound: true };
  return {
    props: {
      diseaseKey: key,
      label: d.label,
      description: d.description,
    },
  };
};

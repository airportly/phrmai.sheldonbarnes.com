import dynamic from 'next/dynamic';
import Head from 'next/head';

// Three.js is client-only, so we dynamically import to avoid SSR issues
const HumanOS = dynamic(() => import('@/components/HumanOS'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Human OS - Cardiometabolic Navigator</title>
        <meta name="description" content="AI-powered clinical interface for cardiometabolic drug discovery" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="min-h-screen bg-[#0a0e27] p-4">
        <HumanOS />
        <footer className="mt-6 text-[10px] text-white/30 text-center max-w-5xl mx-auto leading-relaxed">
          <p>BodyParts3D, Copyright The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan.</p>
          <p>Cardiometabolic-research MCP data sourced from OpenTargets, AlphaFold, AlphaMissense.</p>
        </footer>
      </main>
    </>
  );
}

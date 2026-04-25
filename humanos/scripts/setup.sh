#!/bin/bash
# Human OS - Project setup script
# Initializes the Next.js project with all dependencies needed for v1
# Run this from the project root: bash scripts/setup.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "==========================================="
echo "Human OS - Project Setup"
echo "==========================================="
echo ""
echo "Project root: $PROJECT_ROOT"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed. Install from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18 or higher required. Found: $(node -v)"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "ERROR: npm is not installed."
  exit 1
fi

echo "Node $(node -v) found"
echo "npm $(npm -v) found"
echo ""

# Initialize Next.js project if package.json doesn't exist
if [ ! -f "package.json" ]; then
  echo "Initializing Next.js project..."
  npm init -y > /dev/null

  # Install Next.js, React, TypeScript
  npm install next@latest react@latest react-dom@latest

  # Dev dependencies
  npm install -D typescript @types/react @types/node @types/react-dom
  npm install -D tailwindcss postcss autoprefixer
  npm install -D eslint eslint-config-next

  # Three.js for 3D rendering
  npm install three @types/three

  # Anthropic SDK for Claude API integration
  npm install @anthropic-ai/sdk

  echo ""
  echo "Dependencies installed."
fi

# Create essential config files if they don't exist
if [ ! -f "tsconfig.json" ]; then
  cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF
fi

if [ ! -f "next.config.js" ]; then
  cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf|obj)$/,
      type: 'asset/resource',
    });
    return config;
  },
};
module.exports = nextConfig;
EOF
fi

if [ ! -f "tailwind.config.js" ]; then
  cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'human-os-bg': '#0a0e27',
        'human-os-cyan': '#2dd4bf',
        'human-os-amber': '#fbbf24',
      },
    },
  },
  plugins: [],
};
EOF
fi

# Update package.json scripts
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.scripts = {
  ...pkg.scripts,
  'dev': 'next dev',
  'build': 'next build',
  'start': 'next start',
  'lint': 'next lint',
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Create the .env.local template
if [ ! -f ".env.local.example" ]; then
  cat > .env.local.example << 'EOF'
# Anthropic API key for Claude integration (Phase 3)
ANTHROPIC_API_KEY=

# MCP server URL for cardiometabolic-research
# For local dev, this is the local server. For prod, the internal PhrmAI endpoint.
MCP_SERVER_URL=

# Public flag to indicate dev vs prod build
NEXT_PUBLIC_ENV=development
EOF
fi

# Create gitignore
if [ ! -f ".gitignore" ]; then
  cat > .gitignore << 'EOF'
node_modules/
.next/
out/
.env.local
.env.production
*.log
.DS_Store
public/assets/anatomy/*.glb
EOF
fi

echo ""
echo "==========================================="
echo "Setup complete."
echo "==========================================="
echo ""
echo "Next steps:"
echo "  1. cp .env.local.example .env.local"
echo "  2. Edit .env.local and fill in API keys"
echo "  3. bash scripts/download-bodyparts3d.sh"
echo "  4. python3 scripts/convert-meshes.py"
echo "  5. npm run dev"
echo ""

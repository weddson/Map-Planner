import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
    const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
    const fallbackBase = './';

    return {
      // Use the repository name when running in GitHub Actions, otherwise default to a
      // relative base so the static assets resolve both locally and on GitHub Pages.
      base: isGitHubActions && repoName ? `/${repoName}/` : fallbackBase,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

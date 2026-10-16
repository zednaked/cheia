import { defineConfig } from 'vite';

// base relativa: funciona em https://<user>.github.io/<repo>/ sem configurar nada
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});

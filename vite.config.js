import { defineConfig } from 'vite';


// https://vitejs.dev/config/

export default defineConfig({
   esbuild: {
     jsxFactory: `Snabbdom.createElement`,
     jsxInject: `import Snabbdom from 'snabbdom-pragma'`,
   }
});

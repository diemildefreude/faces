import { defineConfig } from 'vite';

export default defineConfig({
base: './',
server: {
proxy: {
    '/api': 'http://localhost/website/faces/src'
}
}
});
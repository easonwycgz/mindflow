import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['src/generated/**','dist/**','node_modules/**','playwright-report/**','test-results/**']}, ...tseslint.configs.recommended);

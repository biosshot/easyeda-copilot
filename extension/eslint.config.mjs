import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	{
		ignores: [
			'**/build/**',
			'**/coverage/**',
			'**/dist/**',
			'**/node_modules/**',
		]
	},

	eslint.configs.recommended,
	tseslint.configs.recommended,

	{
		files: ['src/**/*.ts', 'web/**/*.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'off',
			'no-useless-escape': 'off',
			'@typescript-eslint/ban-ts-comment': 'off'
		}
	}
);
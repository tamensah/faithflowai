import type { Config } from 'tailwindcss';

const config: Config = {
	content: [
		'./src/**/*.{js,ts,jsx,tsx,mdx}',
		'../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: '#4F46E5',
					50: '#FFFFFF',
					100: '#F5F5FF',
					200: '#E2E1FF',
					300: '#C5C3FF',
					400: '#A7A4FF',
					500: '#8A86FF',
					600: '#6C67FF',
					700: '#4F46E5',
					800: '#3F37B8',
					900: '#2F288A',
				},
				secondary: {
					DEFAULT: '#14B8A6',
					50: '#F7FFFE',
					100: '#E2FFFC',
					200: '#B3FFF7',
					300: '#85FFF2',
					400: '#56FFED',
					500: '#28FFE8',
					600: '#14B8A6',
					700: '#0F8A7D',
					800: '#0A5C54',
					900: '#052E2B',
				},
			},
		},
	},
	plugins: [],
};

export default config;

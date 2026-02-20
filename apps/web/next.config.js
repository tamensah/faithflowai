/** @type {import('next').NextConfig} */
const nextConfig = {
	transpilePackages: ["@faithflow/database"],
};

let withPWA = (config) => config;

try {
	const nextPwa = require('next-pwa');
	withPWA = nextPwa({
		dest: 'public',
		disable: process.env.NODE_ENV === 'development',
		register: true,
		skipWaiting: true,
	});
} catch (error) {
	console.warn('[web] next-pwa is not installed; building without PWA support.');
}

module.exports = withPWA(nextConfig);

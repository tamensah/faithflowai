/** @type {import('next').NextConfig} */
const nextConfig = {
	transpilePackages: ["@faithflow/database"],
	experimental: {
		externalDir: true,
		outputFileTracingRoot: require('path').join(__dirname, '../../'),
	}
}

module.exports = nextConfig
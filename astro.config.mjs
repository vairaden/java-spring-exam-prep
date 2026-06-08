// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const base = '/java-spring-exam-prep';

/**
 * Prepend the configured `base` to root-absolute links written in markdown
 * (e.g. `[x](/block-1/...)`). Astro does not rewrite these automatically, so
 * without this they break when the site is served from a subpath.
 * @returns {(tree: any) => void}
 */
function rehypeBasePath() {
	/** @param {any} node */
	const walk = (node) => {
		if (
			node.type === 'element' &&
			node.tagName === 'a' &&
			typeof node.properties?.href === 'string'
		) {
			const href = node.properties.href;
			if (
				href.startsWith('/') &&
				!href.startsWith('//') &&
				href !== base &&
				!href.startsWith(base + '/')
			) {
				node.properties.href = base + href;
			}
		}
		if (Array.isArray(node.children)) node.children.forEach(walk);
	};
	return (tree) => walk(tree);
}

// https://astro.build/config
export default defineConfig({
	site: 'https://vairaden.github.io',
	base,
	markdown: {
		rehypePlugins: [rehypeBasePath],
	},
	integrations: [
		starlight({
			title: 'Java Spring — подготовка к экзамену',
			defaultLocale: 'root',
			locales: {
				root: { label: 'Русский', lang: 'ru' },
			},
			sidebar: [
				{ label: 'Список вопросов', slug: 'questions' },
				{
					label: 'Блок 1. Spring Core & Web',
					items: [{ autogenerate: { directory: 'block-1' } }],
				},
				{
					label: 'Блок 2. Persistence & Security',
					items: [{ autogenerate: { directory: 'block-2' } }],
				},
				{
					label: 'Блок 3. Reactive, Kafka, Monitoring',
					items: [{ autogenerate: { directory: 'block-3' } }],
				},
				{
					label: 'Лонгриды (лекции)',
					collapsed: true,
					items: [{ autogenerate: { directory: 'longreads' } }],
				},
			],
		}),
	],
});

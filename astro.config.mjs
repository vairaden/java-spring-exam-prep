// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
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

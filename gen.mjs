// Generates a synthetic TS project: N modules, each importing the previous few.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [dir, n = '3000'] = process.argv.slice(2);
const N = Number(n);
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'src'), { recursive: true });

for (let i = 0; i < N; i++) {
	const imports = [1, 2, 3]
		.filter(d => i - d >= 0)
		.map(d => `import { fetch${i - d}, type Model${i - d} } from './m${i - d}';`)
		.join('\n');
	const deps = [1, 2, 3].filter(d => i - d >= 0).map(d => `fetch${i - d}()`);
	writeFileSync(
		join(dir, 'src', `m${i}.ts`),
		`${imports}
export interface Model${i} { id: number; name: string; tags: string[]; parent?: Model${i} }
export async function fetch${i}(): Promise<Model${i}> {
	${deps.length ? `const parts = await Promise.all([${deps.join(', ')}]);` : 'const parts: unknown[] = [];'}
	return { id: ${i}, name: String(parts.length), tags: [] };
}
export function use${i}(m: Model${i}): string {
	return m.tags.map(t => t.toUpperCase()).join(',') + m.name;
}
`
	);
}
writeFileSync(
	join(dir, 'tsconfig.json'),
	JSON.stringify(
		{
			compilerOptions: {
				strict: true,
				target: 'es2022',
				module: 'esnext',
				moduleResolution: 'bundler',
				noEmit: true,
				skipLibCheck: true
			},
			include: ['src']
		},
		null,
		2
	)
);
writeFileSync(
	join(dir, '.oxlintrc.json'),
	JSON.stringify(
		{
			plugins: ['typescript'],
			options: { typeAware: true },
			rules: { 'no-debugger': 'error', 'typescript/no-floating-promises': 'error' }
		},
		null,
		2
	)
);
console.log(`generated ${N} modules in ${dir}`);

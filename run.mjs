// usage: node run.mjs <edits> [--no-type-aware]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { floatingCall, oxlintBin, root, target, tsgolintBin, wrapper } from './paths.mjs';

if (!existsSync(target)) {
	console.error('Run `pnpm generate` first.');
	process.exit(1);
}

const edits = process.argv[2] ?? '15';
const typeAware = !process.argv.includes('--no-type-aware');
const log = join(mkdtempSync(join(tmpdir(), 'tsgolint-')), 'calls.log');
writeFileSync(log, '');

const rcPath = join(root, '.oxlintrc.json');
const rc = readFileSync(rcPath, 'utf8');
writeFileSync(rcPath, JSON.stringify({ ...JSON.parse(rc), options: { typeAware } }, null, 2));

try {
	const client = spawnSync(process.execPath, ['client.mjs', oxlintBin, root, target, edits, '100', floatingCall], {
		cwd: import.meta.dirname,
		env: { ...process.env, OXLINT_TSGOLINT_PATH: wrapper, TSGOLINT_REAL: tsgolintBin, TSGOLINT_LOG: log },
		stdio: ['ignore', 'pipe', 'inherit'],
		encoding: 'utf8'
	});
	const result = JSON.parse(client.stdout.trim().split('\n').at(-1));

	const lines = readFileSync(log, 'utf8')
		.trim()
		.split('\n')
		.filter(Boolean)
		.map(l => l.split(' '));
	const events = lines
		.map(([kind, , t]) => [Number(t), kind === 'start' ? 1 : -1])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	let running = 0;
	let maxConcurrent = 0;
	for (const [, delta] of events) {
		running += delta;
		maxConcurrent = Math.max(maxConcurrent, running);
	}

	console.log(
		JSON.stringify(
			{
				typeAware,
				...result,
				tsgolintLaunches: lines.filter(l => l[0] === 'start').length,
				maxConcurrentTsgolint: maxConcurrent
			},
			null,
			2
		)
	);
} finally {
	writeFileSync(rcPath, rc);
}

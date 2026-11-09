// Baseline: lint the same final content once with the CLI.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { floatingCall, oxlintBin, root, target, tsgolintBin } from './paths.mjs';

if (!existsSync(target)) {
	console.error('Run `pnpm generate` first.');
	process.exit(1);
}

const original = readFileSync(target, 'utf8');
writeFileSync(target, `${original}\ndebugger;\n${floatingCall}\n`);
try {
	const start = performance.now();
	const run = spawnSync(process.execPath, [oxlintBin, target], {
		cwd: root,
		env: { ...process.env, OXLINT_TSGOLINT_PATH: tsgolintBin },
		encoding: 'utf8'
	});
	const ms = Math.round(performance.now() - start);
	const codes = [...new Set([...run.stdout.matchAll(/(\w[\w-]*\([\w-]+\))/g)].map(m => m[1]))].sort();
	console.log(JSON.stringify({ cliMs: ms, codes }, null, 2));
} finally {
	writeFileSync(target, original);
}

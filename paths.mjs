import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const root = join(here, 'synthetic');
export const oxlintBin = join(dirname(require.resolve('oxlint/package.json')), 'bin', 'oxlint');
export const wrapper = join(here, 'tsgolint-wrapper.sh');

// The native binary is a dependency of oxlint-tsgolint, not of this package.
const tsgolintRequire = createRequire(require.resolve('oxlint-tsgolint/package.json'));
export const tsgolintBin = join(
	dirname(tsgolintRequire.resolve(`@oxlint-tsgolint/${process.platform}-${process.arch}/package.json`)),
	'tsgolint'
);

const modules = 15000;
export const target = resolve(root, 'src', `m${modules - 1}.ts`);
// Unawaited call to a function the target imports, so `no-floating-promises` fires.
export const floatingCall = `fetch${modules - 2}();`;

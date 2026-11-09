// Minimal pull-diagnostics LSP client that simulates typing in one file, like VS Code / Zed:
// after every didChange it pulls diagnostics and cancels the previous, now-stale pull.
// usage: node client.mjs <oxlint bin> <project root> <file> <edits> <intervalMs> <appended line>
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [bin, root, file, edits = '15', interval = '100', appended = ''] = process.argv.slice(2);
const N = Number(edits);
const uri = 'file://' + file;
const base = readFileSync(file, 'utf8');
const server = spawn(process.execPath, [bin, '--lsp'], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });

let nextId = 100;
const pending = new Map();
const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);
const send = msg => {
	const s = JSON.stringify({ jsonrpc: '2.0', ...msg });
	server.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`);
};
const request = (method, params) =>
	new Promise(resolve => {
		const id = nextId++;
		pending.set(id, resolve);
		send({ id, method, params });
		return id;
	});

let buf = Buffer.alloc(0);
server.stdout.on('data', chunk => {
	buf = Buffer.concat([buf, chunk]);
	for (;;) {
		const h = buf.indexOf('\r\n\r\n');
		if (h < 0) return;
		const len = Number(/Content-Length: (\d+)/i.exec(buf.subarray(0, h).toString())[1]);
		if (buf.length < h + 4 + len) return;
		const msg = JSON.parse(buf.subarray(h + 4, h + 4 + len).toString());
		buf = buf.subarray(h + 4 + len);
		if (msg.method && msg.id !== undefined) {
			const result = msg.method === 'workspace/configuration' ? msg.params.items.map(() => ({})) : null;
			send({ id: msg.id, result });
		} else if (msg.id !== undefined && pending.has(msg.id)) {
			pending.get(msg.id)(msg);
			pending.delete(msg.id);
		}
	}
});

const init = await request('initialize', {
	processId: process.pid,
	rootUri: 'file://' + root,
	workspaceFolders: [{ uri: 'file://' + root, name: 'root' }],
	capabilities: {
		textDocument: { diagnostic: { dynamicRegistration: false } },
		workspace: { configuration: true, diagnostics: { refreshSupport: true } }
	}
});
const pullMode = Boolean(init.result.capabilities.diagnosticProvider);
send({ method: 'initialized', params: {} });

send({
	method: 'textDocument/didOpen',
	params: { textDocument: { uri, languageId: 'typescript', version: 1, text: base } }
});

const results = [];
let lastPull = null;
const pull = version => {
	const id = nextId;
	const sentAt = ms();
	const p = request('textDocument/diagnostic', { textDocument: { uri } }).then(msg => {
		results.push({
			version,
			id,
			sentAt,
			doneAt: ms(),
			cancelled: msg.error?.code === -32800,
			error: msg.error?.message,
			items: msg.result?.items ?? []
		});
	});
	return { id, p };
};

lastPull = pull(1);
const all = [lastPull.p];
for (let i = 0; i < N; i++) {
	await new Promise(r => setTimeout(r, Number(interval)));
	const version = i + 2;
	const text = base + '\n'.repeat(i + 1) + `debugger;\n${appended}\n`;
	send({ method: 'textDocument/didChange', params: { textDocument: { uri, version }, contentChanges: [{ text }] } });
	send({ method: '$/cancelRequest', params: { id: lastPull.id } });
	lastPull = pull(version);
	all.push(lastPull.p);
}
const typingEndedAt = ms();
await Promise.all(all);

const final = results.find(r => r.version === N + 1);
const codes = [...new Set(final.items.map(d => d.code))].sort();
console.log(
	JSON.stringify({
		pullMode,
		edits: N,
		typingEndedAt,
		finalDiagnosticsAt: final.doneAt,
		lagAfterTyping: final.doneAt - typingEndedAt,
		cancelledHonored: results.filter(r => r.cancelled).length,
		pulls: results.length,
		finalCodes: codes
	})
);
server.kill();
process.exit(0);

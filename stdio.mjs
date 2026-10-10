/** @license SPDX-License-Identifier: Apache-2.0
 * Read-only stdio adapter for the public ProofStack endpoint. No credentials or local files are sent.
 */
import { createInterface } from 'node:readline';
const endpoint = 'https://proof-stack-lake.vercel.app/mcp';
let protocol = '2025-06-18';
let session;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  let message;
  try { message = JSON.parse(line); }
  catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    send({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid request' } }); continue;
  }
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': protocol };
    if (session) headers['Mcp-Session-Id'] = session;
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(message), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Public endpoint unavailable');
    if (response.headers.get('Mcp-Session-Id')) session = response.headers.get('Mcp-Session-Id');
    if (response.status === 202 || !Object.hasOwn(message, 'id')) continue;
    const result = await response.json();
    if (result.jsonrpc !== '2.0' || result.id !== message.id) throw new Error('Invalid endpoint response');
    if (message.method === 'initialize' && result.result?.protocolVersion) protocol = result.result.protocolVersion;
    send(result);
  } catch {
    if (Object.hasOwn(message, 'id')) send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: 'ProofStack public endpoint temporarily unavailable' } });
  }
}

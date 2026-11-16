/**
 * ДРУГИЙ БІК (крок 09): застосунок викликає ті самі інструменти.
 * Запуск: npx tsx scripts/mcp-demo.ts "код помилки E-418"
 */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';

const query = process.argv[2] ?? 'батут';

const client = new Client({ name: 'lab2-app', version: '1.0.0' });

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp/server.ts'],
  env: { ...getDefaultEnvironment(), MCP_CLIENT_LABEL: 'lab2-app' },
});

function show(result: Awaited<ReturnType<typeof client.callTool>>): void {
  for (const block of result.content) {
    if (block.type === 'text') console.log(block.text);
  }
  if (result.isError) console.log('^ це ВІДМОВА сервера, і вона очікувана');
}

try {
  await client.connect(transport);
  console.log('--- Підключено до MCP-сервера ---');

  const { tools } = await client.listTools();
  console.log('\nДоступні інструменти:');
  for (const tool of tools) console.log(`- ${tool.name}: ${(tool.description ?? "").split('.')[0]}`);

  console.log('\n--- Виклик 1: search_corpus ---');
  show(await client.callTool({ name: 'search_corpus', arguments: { query, topK: 3 } }));

  console.log('\n--- Виклик 2: fetch_chunk (успішний) ---');
  show(await client.callTool({ name: 'fetch_chunk', arguments: { id: 'doc-01#0000' } }));

  console.log('\n--- Виклик 3: fetch_chunk (за межею індексу) ---');
  show(await client.callTool({ name: 'fetch_chunk', arguments: { id: 'doc-99#0000' } }));

} catch (error) {
  console.error('Помилка виконання:', error);
} finally {
  await client.close();
}
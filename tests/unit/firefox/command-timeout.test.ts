import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server, type RequestListener } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { Command, Name } from 'selenium-webdriver/lib/command.js';
const { Executor, HttpClient } = createRequire(import.meta.url)(
  'selenium-webdriver/http'
) as typeof import('selenium-webdriver/http');
import { guardWebDriverCommands } from '@/firefox/command-timeout.js';

let server: Server;

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function start(handler: RequestListener) {
  server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return new Executor(new HttpClient(`http://127.0.0.1:${port}`));
}

function command() {
  return new Command(Name.GET_CURRENT_WINDOW_HANDLE).setParameter('sessionId', 'test');
}

describe('WebDriver command deadline', () => {
  it('preserves successful responses and protocol errors without disconnecting', async () => {
    let requests = 0;
    let disconnects = 0;
    const executor = await start((_req, res) => {
      requests++;
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = requests === 2 ? 404 : 200;
      res.end(
        JSON.stringify({
          value:
            requests === 2
              ? { error: 'no such window', message: 'Window closed', stacktrace: '' }
              : 'window-1',
        })
      );
    });
    guardWebDriverCommands(
      executor,
      async () => {
        disconnects++;
      },
      1000
    );
    await expect(executor.execute(command())).resolves.toBe('window-1');
    await expect(executor.execute(command())).rejects.toThrow('Window closed');
    await expect(executor.execute(command())).resolves.toBe('window-1');
    expect(disconnects).toBe(0);
  });

  it('releases concurrent requests and refuses to replay commands on a stalled session', async () => {
    let requests = 0;
    let disconnects = 0;
    const executor = await start(() => {
      requests++;
    });
    guardWebDriverCommands(
      executor,
      async () => {
        disconnects++;
        server.closeAllConnections();
      },
      100
    );
    const results = await Promise.allSettled([
      executor.execute(command()),
      executor.execute(command()),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason.message).toContain('operation may have completed');
      }
    }
    expect(disconnects).toBe(1);
    expect(requests).toBe(2);
    await expect(executor.execute(command())).rejects.toThrow('timed out');
    expect(requests).toBe(2);
  });

  it('does not report a late response as success while disconnect is in progress', async () => {
    const executor = await start((_req, res) => {
      setTimeout(() => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ value: 'late-window' }));
      }, 100);
    });
    guardWebDriverCommands(
      executor,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        server.closeAllConnections();
      },
      50
    );
    await expect(executor.execute(command())).rejects.toThrow('timed out');
  });
});

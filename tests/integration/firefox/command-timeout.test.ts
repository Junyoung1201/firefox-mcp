import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestFirefox, closeFirefox, waitFor } from '../../helpers/firefox.js';
import type { FirefoxClient } from '@/firefox/index.js';

describe.skipIf(process.platform !== 'linux')('Stalled geckodriver recovery', () => {
  let browser: ChildProcess;
  let client: FirefoxClient | undefined;
  let profile: string;
  let port: number;
  let driverPid: number | undefined;

  beforeAll(async () => {
    profile = mkdtempSync(join(tmpdir(), 'mcp-deadline-test-'));
    writeFileSync(join(profile, 'user.js'), 'user_pref("marionette.port", 0);\n');
    browser = spawn(
      process.env.FIREFOX_PATH || 'firefox',
      [
        '-headless',
        '-no-remote',
        '-profile',
        profile,
        '--marionette',
        '--remote-debugging-port',
        '0',
        'about:blank',
      ],
      { stdio: 'ignore' }
    );
    const portFile = join(profile, 'MarionetteActivePort');
    await waitFor(() => existsSync(portFile), 30000);
    port = Number(readFileSync(portFile, 'utf8').trim());
    client = await createTestFirefox({ connectExisting: true, marionettePort: port });
  });

  afterAll(async () => {
    if (driverPid) {
      try {
        process.kill(driverPid, 'SIGKILL');
      } catch {
        /* already stopped */
      }
    }
    await closeFirefox(client);
    if (browser?.exitCode === null) {
      const exited = new Promise<void>((resolve) => browser.once('exit', () => resolve()));
      browser.kill('SIGKILL');
      await exited;
    }
    if (profile) {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  it('bounds a stalled command and reconnects without closing the existing browser', async () => {
    const processes = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
    const line = processes
      .split('\n')
      .find(
        (entry) => entry.includes('geckodriver') && entry.includes(`--marionette-port=${port}`)
      );
    expect(line).toBeDefined();
    driverPid = Number(line!.trim().split(/\s+/)[0]);
    process.kill(driverPid, 'SIGSTOP');
    const started = Date.now();
    await expect(client!.getDriver().getWindowHandle()).rejects.toThrow(
      'WebDriver command timed out'
    );
    expect(Date.now() - started).toBeLessThan(22000);
    driverPid = undefined;
    expect(browser.exitCode).toBeNull();
    await closeFirefox(client);
    client = await createTestFirefox({ connectExisting: true, marionettePort: port });
    await client.refreshTabs();
    expect(client.getTabs().some((tab) => tab.url === 'about:blank')).toBe(true);
  }, 35000);
});

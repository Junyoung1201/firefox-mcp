import type { Executor } from 'selenium-webdriver/lib/command.js';
import { log } from '../utils/logger.js';

export const WEBDRIVER_COMMAND_TIMEOUT_MS = 15_000;

/** A stalled Marionette command must not hold every subsequent tool indefinitely. */
export function guardWebDriverCommands(
  executor: Executor,
  disconnect: () => Promise<void>,
  timeoutMs = WEBDRIVER_COMMAND_TIMEOUT_MS
): void {
  const execute = executor.execute.bind(executor);
  let failure: Error | undefined;
  let invalidate: (reason: Error) => void;
  const invalidated = new Promise<never>((_, reject) => {
    invalidate = reject;
  });
  void invalidated.catch(() => {});

  executor.execute = async (command) => {
    if (failure) {
      throw failure;
    }
    const timer = setTimeout(() => {
      if (failure) {
        return;
      }
      failure = new Error(
        `WebDriver command timed out after ${timeoutMs} ms: ${command.getName()}. ` +
          'The connection has been invalidated. The operation may have completed; ' +
          'inspect the page before retrying any action. The next tool call can reconnect.'
      );
      const error = failure;
      log(error.message);
      void Promise.resolve()
        .then(disconnect)
        .catch(() => {})
        .finally(() => invalidate(error));
    }, timeoutMs);
    try {
      const result = await Promise.race([execute(command), invalidated]);
      return failure ? await invalidated : result;
    } catch (error) {
      if (failure) {
        return await invalidated;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

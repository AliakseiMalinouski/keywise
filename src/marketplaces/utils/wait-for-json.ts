import type { Page, Response } from 'playwright';

export function waitForJson<T>(
  page: Page,
  match: (response: Response) => boolean,
  read: (payload: unknown) => T | null,
  timeoutMs = 8000,
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      page.off('response', onResponse);
      resolve(null);
    }, timeoutMs);

    const onResponse = (response: Response): void => {
      if (!match(response)) {
        return;
      }

      void response
        .json()
        .then((payload: unknown) => {
          const value = read(payload);
          if (value == null) {
            return;
          }

          clearTimeout(timer);
          page.off('response', onResponse);
          resolve(value);
        })
        .catch(() => {
          /* ignore non-json responses */
        });
    };

    page.on('response', onResponse);
  });
}

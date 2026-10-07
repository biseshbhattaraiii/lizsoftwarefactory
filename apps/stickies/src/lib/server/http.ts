export const error = (status: number, message: string) =>
  Response.json({ error: message }, { status });

export const readJson = (req: Request): Promise<unknown> => req.json().catch(() => null);

/** Wraps a handler so storage failures become a 500 instead of an unhandled crash. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(e);
      return error(500, "Something went wrong saving that. Please try again.");
    }
  };
}

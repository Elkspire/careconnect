/** Runs `task` over every item, at most `size` at a time. */
export async function inBatches<T>(
  items: T[],
  size: number,
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(task));
  }
}

# svelte-store-tree

Provides writable/readable stores that can 'zoom' into the part of the store value.

# Example

```typescript
```

# API Overview

```typescript
export function writableTree<P>(
  value: P,
  start: StartStopNotifier<P> = noop,
): WritableTree<P>;

export function readableTree<P>(
  value: P,
  start: StartStopNotifier<P> = noop,
): ReadableTree<P>

export type WritableTreeCore<P> = {
  zoom<C>(accessor: Accessor<P, C>): ReadableTree<C>;

  zoomWritable<C>(accessor: Accessor<P, C>): WritableTree<C>;

  zoomIn<K extends keyof P>(k: K): ReadableTree<P[K]>;

  zoomInWritable<K extends keyof P>(k: K): WritableTree<P[K]>;

  choose<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): ReadableTree<P_>;

  chooseWritable<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): WritableTree<P_>;
};
```

# Working Example App

<a href="https://codesandbox.io/p/github/igrep/svelte-store-tree/draft/floral-sound?workspace=%257B%2522activeFileId%2522%253Anull%252C%2522openFiles%2522%253A%255B%255D%252C%2522sidebarPanel%2522%253A%2522EXPLORER%2522%252C%2522gitSidebarPanel%2522%253A%2522COMMIT%2522%252C%2522sidekickItems%2522%253A%255B%257B%2522type%2522%253A%2522PREVIEW%2522%252C%2522taskId%2522%253A%2522dev%2522%252C%2522port%2522%253A5173%252C%2522key%2522%253A%2522cl84b20px00942a69505zsdx2%2522%252C%2522isMinimized%2522%253Afalse%252C%2522path%2522%253A%2522%252Fexample%252F%2522%257D%252C%257B%2522type%2522%253A%2522TASK_LOG%2522%252C%2522taskId%2522%253A%2522dev%2522%252C%2522key%2522%253A%2522cl84b1zcx00452a69im60ktrw%2522%252C%2522isMinimized%2522%253Afalse%257D%255D%257D">
Run on CodeSandbox

![Example App running on CodeSandbox](./docs/codesandbox.png "Example App running on CodeSandbox")
</a>

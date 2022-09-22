# svelte-store-tree

Current status: Experimental.

Provides writable/readable stores that can 'zoom' into a part of the store
value. It enables us to manage the state of the app in a single object while
keeping the independence of every child component.

# Example

<!-- BEGIN README TEST -->

```typescript
import { writableTree, Refuse } from 'svelte-store-tree';
import type { WritableTree } from 'svelte-store-tree';

type SomeRecord = {
  id: number;
  name: string;
  contact: {
    phone: string;
    urls: string[];
  };
  favoriteColor: Color | undefined;
};

type Color = [number, number, number];

// Create a `WritableTree`
const someRecord: WritableTree<SomeRecord> = writableTree({
  id: 0,
  name: 'Y. Y',
  contact: {
    phone: '+81-00-0000-0000',
    urls: [
      'https://the.igreque.info',
      'https://github.com/igrep',
    ],
  },
  favoriteColor: undefined
});

// Subscribe as an ordinary store.
someRecord.subscribe((newUser) => {
  console.log('Updated the user', newUser);
});

// `zoomIn` / `zoomInWritable`:
//    Create a store that subscribes only a specific field of the object
const name = someRecord.zoomInWritable('name');
const contact = someRecord.zoomInWritable('contact');
const favoriteColor = someRecord.zoomInWritable('favoriteColor');

name.subscribe((newName) => {
  console.log('Updated the name', newName);
});
contact.subscribe((newContact) => {
  console.log('Updated the contact', newContact);
});
favoriteColor.subscribe((newColor) => {
  console.log('Updated the color', newColor);
});

// We can apply `zoomIn`/`zoomInWritable` deeper:
const urls = contact.zoomInWritable('urls');

// Notifies the subscribers of `someRecord`, `contact`, and `urls`.
// ** Changes are propagated only to the direct subscribers, and the ancestors'. **
// ** Not to the the siblings' to avoid extra rerendering of the subscribing components. **
urls.update((u) => [...u, 'https://twitter.com/igrep']);

// If your record has a union type, `chooseWritable` is useful.
// Pass a function that returns a `Refuse` (a unique symbol provided by this library)
// if the value doesn't satisfy the condition.
const favoriteColorNonUndefined =
  favoriteColor.chooseWritable((color) => color ?? Refuse);
// Now, favoriteColorNonUndefined is typed as `WritableTree<Color>`,
// while favoriteColor is `WritableTree<Color | undefined>`.

favoriteColorNonUndefined.subscribe((newColor) => {
  console.log('Updated the color', newColor);
});

// Notifies the subscribers of `someRecord`, `favoriteColor`, and `favoriteColorNonUndefined`.
favoriteColor.set([0xC0, 0x10, 0x10]);

// Notifies the subscribers of `someRecord`, and `favoriteColor` (not `favoriteColorNonUndefined`).
favoriteColor.set(undefined);
```

<!-- END README TEST -->

# Working Example App

<a href="https://codesandbox.io/p/github/igrep/svelte-store-tree/draft/floral-sound?workspace=%257B%2522activeFileId%2522%253Anull%252C%2522openFiles%2522%253A%255B%255D%252C%2522sidebarPanel%2522%253A%2522EXPLORER%2522%252C%2522gitSidebarPanel%2522%253A%2522COMMIT%2522%252C%2522sidekickItems%2522%253A%255B%257B%2522type%2522%253A%2522PREVIEW%2522%252C%2522taskId%2522%253A%2522dev%2522%252C%2522port%2522%253A5173%252C%2522key%2522%253A%2522cl84b20px00942a69505zsdx2%2522%252C%2522isMinimized%2522%253Afalse%252C%2522path%2522%253A%2522%252Fexample%252F%2522%257D%252C%257B%2522type%2522%253A%2522TASK_LOG%2522%252C%2522taskId%2522%253A%2522dev%2522%252C%2522key%2522%253A%2522cl84b1zcx00452a69im60ktrw%2522%252C%2522isMinimized%2522%253Afalse%257D%255D%257D">
Run on CodeSandbox

![Example App running on CodeSandbox](./docs/codesandbox.png "Example App running on CodeSandbox")
</a>

# API

```typescript
export function writableTree<P>(
  value: P,
  start: StartStopNotifier<P> = noop,
): WritableTree<P>;

export function readableTree<P>(
  value: P,
  start: StartStopNotifier<P> = noop,
): ReadableTree<P>

export type ReadableTree<P> = Readable<P> & WritableTreeCore<P>;

export type WritableTree<P> = Writable<P> & WritableTreeCore<P>;

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

export const Refuse: unique symbol = Symbol();
export type Refuse = typeof Refuse;

export function objectAccessor<P, K extends keyof P>(
  key: K,
): Accessor<P, P[K]>;

export function mapAccessor<K extends Key, V>(key: K): Accessor<Map<K, V>, V>;

export type Key = string | number | symbol;

export type Accessor<P, C> = {
  readChild: (parent: P) => C | Refuse;
  writeChild: (parent: P, newChild: C) => void;
};
```

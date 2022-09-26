import { noop, safe_not_equal } from "svelte/internal";
import type {
  Readable,
  StartStopNotifier,
  Subscriber,
  Unsubscriber,
  Updater,
  Writable,
} from "svelte/store";

// import { pr } from './debug';

/** Cleanup logic callback. */
type Invalidator<T> = (value?: T) => void;

export const Refuse: unique symbol = Symbol();
export type Refuse = typeof Refuse;

type Getter<T> = () => T | Refuse;

export type Key = string | number | symbol;

export type Accessor<P, C> = {
  readChild: (parent: P) => C | Refuse;
  writeChild: (parent: P, newChild: C) => void;
};

type SubscribersNode = {
  r: Subscriber<unknown>;
  i: Invalidator<unknown>;
  g: Getter<unknown>;
};

type GetterAndChild = {
  g: Getter<unknown>;
  c: SubscribersTree;
};

type SubscribersTree = {
  children: Set<GetterAndChild>;
  thisSubscribers: Set<SubscribersNode>;
};

export function objectAccessor<P, K extends keyof P>(
  key: K,
): Accessor<P, P[K]> {
  return {
    readChild: (parent: P) => parent[key],
    writeChild: (parent: P, newChild: P[K]) => (parent[key] = newChild),
  };
}

export function mapAccessor<K extends Key, V>(key: K): Accessor<Map<K, V>, V> {
  return {
    readChild: (parent: Map<K, V>) =>
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      parent.has(key) ? parent.get(key)! : Refuse,
    writeChild: (parent: Map<K, V>, newChild: V) => {
      parent.set(key, newChild);
    },
  };
}

export type ReadableTreeCore<P> = {
  zoom<C>(accessor: Accessor<P, C>): ReadableTree<C>;

  zoomIn<K extends keyof P>(k: K): ReadableTree<P[K]>;

  choose<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): ReadableTree<P_>;
}

export type WritableTreeCore<P> = ReadableTreeCore<P> & {
  zoomWritable<C>(accessor: Accessor<P, C>): WritableTree<C>;

  zoomInWritable<K extends keyof P>(k: K): WritableTree<P[K]>;

  chooseWritable<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): WritableTree<P_>;
};

export type ReadableTree<P> = Readable<P> & ReadableTreeCore<P>;

export type WritableTree<P> = Writable<P> & WritableTreeCore<P>;

// type SubscriberQueue = [] | [Subscriber<T>, T, ...(SubscriberQueue | [])];
type SubscriberQueue = any[];
const subscriber_queue: SubscriberQueue = [];

type ParentSubscriber = (queue: SubscriberQueue) => void;

export function readableTree<P>(
  value: P,
  start: StartStopNotifier<P> = noop,
): ReadableTree<P> {
  const {
    subscribe,
    zoom,
    zoomIn,
    choose,
  } = writableTree(value, start);
  return {
    subscribe,
    zoom,
    zoomIn,
    choose,
  };
}

export function writableTree<P>(
  value: P,
  start: StartStopNotifier<P> = noop,
): WritableTree<P> {
  const tree: SubscribersTree = {
    children: new Set(),
    thisSubscribers: new Set(),
  };

  let countAllSubscribers = 0;
  let stop: Unsubscriber | undefined;
  return writableTreeCore(
    () => value,
    (newValue: P) => (value = newValue),
    tree,
    function incrementThenStartIfNecessary(set: Subscriber<P>) {
      ++countAllSubscribers;
      if (countAllSubscribers === 1) {
        stop = start(set) || noop;
      }
    },
    function decrementThenStopIfNecessary() {
      --countAllSubscribers;
      if (countAllSubscribers === 0) {
        (stop as Unsubscriber)();
        stop = undefined;
      }
    },
    function isReady() {
      return !!stop;
    },
    [],
  );
}

function writableTreeCore<P>(
  getValue: () => P | Refuse,
  writeValue: (newValue: P) => void,
  tree: SubscribersTree,
  incrementThenStartIfNecessary: StartStopNotifier<P>,
  decrementThenStopIfNecessary: Unsubscriber,
  isReady: () => boolean,
  parentSubscribers: ParentSubscriber[],
): WritableTree<P> {
  function set(new_value: P): void {
    if (safe_not_equal(getValue(), new_value)) {
      writeValue(new_value);
      if (isReady()) {
        // store is ready
        const run_queue = !subscriber_queue.length;
        for (const parentSubscriber of parentSubscribers) {
          parentSubscriber(subscriber_queue);
        }
        for (const subscriber of tree.thisSubscribers) {
          subscriber.i();
          const chosenValue = subscriber.g();
          if (chosenValue !== Refuse) {
            subscriber_queue.push(subscriber, chosenValue);
          }
        }

        const tmpQueue: GetterAndChild[] = [];
        for (const getterAndChild of tree.children.values()) {
          tmpQueue.push(getterAndChild);
        }
        let getterAndChild: GetterAndChild | undefined;
        while ((getterAndChild = tmpQueue.shift())) {
          for (const subscribersNode of getterAndChild.c.thisSubscribers) {
            subscribersNode.i();
            const chosenChild = subscribersNode.g();
            if (chosenChild !== Refuse) {
              subscriber_queue.push(subscribersNode, chosenChild);
            }
          }

          for (const childNode of getterAndChild.c.children.values()) {
            tmpQueue.push(childNode);
          }
        }

        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i].r(subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }

  function update(fn: Updater<P>): void {
    const v = getValue();
    if (v !== Refuse) {
      set(fn(v));
    }
  }

  function subscribe(
    run: Subscriber<P>,
    invalidate: Invalidator<P> = noop,
  ): Unsubscriber {
    const subscriber: SubscribersNode = {
      r: run as Subscriber<unknown>,
      i: invalidate as Invalidator<unknown>,
      g: getValue,
    };
    tree.thisSubscribers.add(subscriber);
    incrementThenStartIfNecessary(set);
    const v = getValue();
    if (v !== Refuse) {
      run(v);
    }

    return () => {
      tree.thisSubscribers.delete(subscriber);
      decrementThenStopIfNecessary();
    };
  }

  function zoom<C>(accessor: Accessor<P, C>): ReadableTree<C> {
    const {
      subscribe,
      zoom,
      zoomIn,
      choose,
    } = zoomWritable(accessor);
    return {
      subscribe,
      zoom,
      zoomIn,
      choose,
    };
  }

  function zoomWritable<C>(accessor: Accessor<P, C>): WritableTree<C> {
    const getter = () => {
      const v = getValue();
      if (v === Refuse) {
        return Refuse;
      }
      return accessor.readChild(v);
    };
    const child: GetterAndChild = {
      g: getter as Getter<unknown>,
      c: {
        children: new Set(),
        thisSubscribers: new Set(),
      },
    };
    tree.children.add(child);

    return writableTreeCore(
      getter,
      (newChild: C) => {
        const v = getValue();
        if (v === Refuse) {
          return;
        }
        accessor.writeChild(v, newChild);
      },
      child.c,
      function incrementThenStartIfNecessaryForChild(set: Subscriber<C>) {
        incrementThenStartIfNecessary((parent: P) => {
          const v = accessor.readChild(parent);
          if (v !== Refuse) {
            set(v);
          }
        });
      },
      decrementThenStopIfNecessary,
      isReady,
      [
        ...parentSubscribers,
        (subscriber_queue: SubscriberQueue) => {
          for (const subscriber of tree.thisSubscribers) {
            const chosenValue = subscriber.g();
            if (chosenValue !== Refuse) {
              subscriber.i();
              subscriber_queue.push(subscriber, chosenValue);
            }
          }
        },
      ],
    );
  }

  function zoomIn<K extends keyof P>(k: K): ReadableTree<P[K]> {
    return zoom(objectAccessor<P, K>(k));
  }

  function zoomInWritable<K extends keyof P>(k: K): WritableTree<P[K]> {
    return zoomWritable(objectAccessor<P, K>(k));
  }

  function choose<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): ReadableTree<P_> {
    const {
      subscribe,
      zoom,
      zoomIn,
      choose,
    } = chooseWritable(chooseParent);
    return {
      subscribe,
      zoom,
      zoomIn,
      choose,
    };
  }

  function chooseWritable<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): WritableTree<P_> {
    return writableTreeCore<P_>(
      function newGetValue(): P_ | Refuse {
        const v = getValue();
        if (v === Refuse) {
          return Refuse;
        }
        return chooseParent(v);
      },
      writeValue,
      tree,
      incrementThenStartIfNecessary as StartStopNotifier<P_>,
      decrementThenStopIfNecessary,
      isReady,
      parentSubscribers,
    );
  }

  return {
    set,
    update,
    subscribe,
    zoom,
    zoomWritable,
    zoomIn,
    zoomInWritable,
    choose,
    chooseWritable,
  };
}

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

type Chooser<T, T_ extends T = T> = (value: T) => T_ | Refuse;

export type Key = string | number | symbol;

export type Accessor<P, C> = {
  readChild: (parent: P) => C;
  writeChild: (parent: P, newChild: C) => void;
};

type SubscribersNode = {
  r: Subscriber<unknown>;
  i: Invalidator<unknown>;
  c: Chooser<unknown>;
};

type AccessorAndChild = {
  a: Accessor<unknown, unknown>;
  c: SubscribersTree;
  cp: Chooser<unknown>; // choose parent
};

type SubscribersTree = {
  children: Set<AccessorAndChild>;
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

export function mapAccessor<K extends Key, V>(
  key: K,
): Accessor<Map<K, V>, V | undefined> {
  return {
    readChild: (parent: Map<K, V>) => parent.get(key),
    writeChild: (parent: Map<K, V>, newChild: V | undefined) => {
      if (newChild === undefined) {
        parent.delete(key);
        return;
      }
      parent.set(key, newChild);
    },
  };
}

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

export type ReadableTree<P> = Readable<P> & WritableTreeCore<P>;

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
    zoomWritable,
    zoomIn,
    zoomInWritable,
    choose,
    chooseWritable,
  } = writableTree(value, start);
  return {
    subscribe,
    zoom,
    zoomWritable,
    zoomIn,
    zoomInWritable,
    choose,
    chooseWritable,
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
    (parent: P) => parent,
  );
}

function writableTreeCore<P, P_ extends P = P>(
  getValue: () => P,
  writeValue: (newValue: P) => void,
  tree: SubscribersTree,
  incrementThenStartIfNecessary: StartStopNotifier<P>,
  decrementThenStopIfNecessary: Unsubscriber,
  isReady: () => boolean,
  parentSubscribers: ParentSubscriber[],
  chooser: Chooser<P, P_>,
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
        const currentValue = getValue();
        for (const subscriber of tree.thisSubscribers) {
          subscriber.i();
          const chosenValue = subscriber.c(currentValue);
          if (chosenValue !== Refuse) {
            subscriber_queue.push(subscriber, chosenValue);
          }
          // console.log('Rejected a child THIS AAAA');
        }

        // type TmpQueue = [AccessorAndChild, T, ...(TmpQueue | [])];
        // const tmpQueue: TmpQueue;
        const tmpQueue: any[] = [];
        for (const accessorAndChild of tree.children.values()) {
          const chosenValue = accessorAndChild.cp(currentValue);
          if (chosenValue !== Refuse) {
            tmpQueue.push(
              accessorAndChild,
              accessorAndChild.a.readChild(chosenValue),
            );
          }
          // console.log('Rejected a CHILD AAAA');
        }
        let accessorAndChild: AccessorAndChild | undefined;
        let child: any;
        while (tmpQueue.length) {
          accessorAndChild = tmpQueue.shift() as AccessorAndChild;
          child = tmpQueue.shift();

          for (const subscribersNode of accessorAndChild.c.thisSubscribers) {
            const chosenChild = subscribersNode.c(child);
            if (chosenChild !== Refuse) {
              subscribersNode.i();
              subscriber_queue.push(subscribersNode, chosenChild);
            }
            // console.log('Rejected a child THIS BBBB');
          }

          for (const childNode of accessorAndChild.c.children.values()) {
            const chosenChild = childNode.cp(child);
            if (chosenChild !== Refuse) {
              tmpQueue.push(childNode, childNode.a.readChild(chosenChild));
            }
            // console.log('Rejected a CHILD BBBB');
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
    set(fn(getValue()));
  }

  function subscribe(
    run: Subscriber<P>,
    invalidate: Invalidator<P> = noop,
  ): Unsubscriber {
    const subscriber: SubscribersNode = {
      r: run as Subscriber<unknown>,
      i: invalidate as Invalidator<unknown>,
      c: chooser as Chooser<unknown>,
    };
    tree.thisSubscribers.add(subscriber);
    incrementThenStartIfNecessary(set);
    const chosenValue = chooser(getValue());
    if (chosenValue !== Refuse) {
      run(chosenValue);
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
      zoomWritable: zw,
      zoomIn,
      zoomInWritable,
      choose,
      chooseWritable,
    } = zoomWritable(accessor);
    return {
      subscribe,
      zoom,
      zoomWritable: zw,
      zoomIn,
      zoomInWritable,
      choose,
      chooseWritable,
    };
  }

  function zoomWritable<C>(accessor: Accessor<P, C>): WritableTree<C> {
    const child: AccessorAndChild = {
      a: accessor as Accessor<unknown, unknown>,
      c: {
        children: new Set(),
        thisSubscribers: new Set(),
      },
      cp: chooser as Chooser<unknown>,
    };
    tree.children.add(child);

    return writableTreeCore(
      () => accessor.readChild(getValue()),
      (newChild: C) => accessor.writeChild(getValue(), newChild),
      child.c,
      function incrementThenStartIfNecessaryForChild(set: Subscriber<C>) {
        incrementThenStartIfNecessary((parent: P) =>
          set(accessor.readChild(parent)),
        );
      },
      decrementThenStopIfNecessary,
      isReady,
      [
        ...parentSubscribers,
        (subscriber_queue: SubscriberQueue) => {
          const currentValue = getValue();
          for (const subscriber of tree.thisSubscribers) {
            const chosenValue = subscriber.c(currentValue);
            subscriber.i();
            if (chosenValue !== Refuse) {
              subscriber_queue.push(subscriber, chosenValue);
            }
          }
        },
      ],
      (child: C) => child,
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
      zoomWritable,
      zoomIn,
      zoomInWritable,
      choose,
      chooseWritable: cw,
    } = chooseWritable(chooseParent);
    return {
      subscribe,
      zoom,
      zoomWritable,
      zoomIn,
      zoomInWritable,
      choose,
      chooseWritable: cw,
    };
  }

  function chooseWritable<P_ extends P>(
    chooseParent: (parent: P) => P_ | Refuse,
  ): WritableTree<P_> {
    return writableTreeCore<P_>(
      getValue as () => P_,
      writeValue,
      tree,
      incrementThenStartIfNecessary as StartStopNotifier<P_>,
      decrementThenStopIfNecessary,
      isReady,
      parentSubscribers,
      function newChooser(parent: P): P_ | Refuse {
        const chosenValue0 = chooser(parent);
        if (chosenValue0 === Refuse) {
          return Refuse;
        }
        // console.log('Rejected a PARENT');
        return chooseParent(chosenValue0);
      },
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

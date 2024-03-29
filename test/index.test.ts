import { beforeEach, describe, expect, it, test } from "vitest";

import { into, isPresent, Refuse, readableTree, writableTree, type WritableTree } from "../src";

describe("readableTree", () => {
  // Translated from Svelte's test suite:
  // https://github.com/sveltejs/svelte/pull/6750/files#diff-6c841bedaaa45461314f6b84fc7ab1ded9884e0922831d8ce750145362465317R140

  it('passes an optional update and set function to the start stop notifier', () => {
    let running = false;
    let tick: (value: number) => void;
    let add: (value: number) => void;

    const store = readableTree(0, (set, update) => {
      tick = set;
      running = true;
      add = n => update(value => value + n);

      set(0);

      return () => {
        tick = () => { /* empty */ };
        add = _ => { /* empty */ };
        running = false;
      };
    });

    expect(running).toEqual(false);

    const values: number[] = [];

    const unsubscribe = store.subscribe(value => {
      values.push(value);
    });

    expect(running).toEqual(true);
    tick!(1);
    tick!(2);
    add!(3);
    add!(4);
    tick!(5);
    add!(6);

    unsubscribe();

    expect(running).toEqual(false);
    tick!(7);
    add!(8);

    expect(values).toEqual([0, 1, 2, 5, 9, 5, 11]);
  });
});

describe("writableTree", () => {
  it("creates a writable store", () => {
    const count = writableTree(0);
    const values: number[] = [];

    const unsubscribe = count.subscribe((value) => {
      values.push(value);
    });

    count.set(1);
    count.update((n) => n + 1);

    unsubscribe();

    count.set(3);
    count.update((n) => n + 1);

    expect(values).toEqual([0, 1, 2]);
  });

  it("creates an undefined writable store", () => {
    // eslint-disable-next-line
    // @ts-ignore
    const store = writableTree();
    const values: any[] = [];

    const unsubscribe = store.subscribe((value) => {
      values.push(value);
    });

    unsubscribe();

    expect(values).toEqual([undefined]);
  });

  it("calls provided subscribe handler", () => {
    let called = 0;

    const store = writableTree(0, () => {
      called += 1;
      return () => (called -= 1);
    });

    const unsubscribe1 = store.subscribe(() => {
      /* intentionally empty */
    });
    expect(called).toEqual(1);

    const unsubscribe2 = store.subscribe(() => {
      /* intentionally empty */
    });
    expect(called).toEqual(1);

    unsubscribe1();
    expect(called).toEqual(1);

    unsubscribe2();
    expect(called).toEqual(0);
  });

  it("does not assume immutable data", () => {
    const obj = {};
    let called = 0;

    const store = writableTree(obj);

    store.subscribe(() => {
      called += 1;
    });

    store.set(obj);
    expect(called).toEqual(2);

    store.update((obj) => obj);
    expect(called).toEqual(3);
  });

  it("only calls subscriber once initially, including on resubscriptions", () => {
    let num = 0;
    const store = writableTree(num, (set) => set((num += 1)));

    let count1 = 0;
    let count2 = 0;

    store.subscribe(() => (count1 += 1))();
    expect(count1).toEqual(1);

    const unsubscribe = store.subscribe(() => (count2 += 1));
    expect(count2).toEqual(1);

    unsubscribe();
  });

  describe("zoom", () => {
    describe("when setting the parent writable", () => {
      it("calls both child subscribers and parent subscribers by setting the parent writable", () => {
        type Parent = {
          one: number;
          two: number;
          three: number;
        };
        const initParent = {
          one: 1,
          two: 2,
          three: 3,
        };
        const parent = writableTree(initParent);
        const childOne = parent.zoom(into("one"));
        const childTwo = parent.zoom(into("two"));
        const childThree = parent.zoom(into("three"));

        const called = {
          one: [] as number[],
          two: [] as number[],
          three: [] as number[],
          parent: [] as Parent[],
        };

        childOne.subscribe((newOne) => {
          called.one.push(newOne);
        });
        childTwo.subscribe((newTwo) => {
          called.two.push(newTwo);
        });
        childThree.subscribe((newThree) => {
          called.three.push(newThree);
        });
        parent.subscribe((newParent) => {
          called.parent.push(newParent);
        });

        parent.set(initParent);
        expect(called).toEqual({
          one: [1, 1],
          two: [2, 2],
          three: [3, 3],
          parent: [initParent, initParent],
        });
      });

      it("calls all descendant subscribers by setting the parent writable", () => {
        type Parent = {
          one: {
            two: {
              three: number;
            };
          };
        };
        const initParent = {
          one: {
            two: {
              three: 0,
            },
          },
        };
        const parent = writableTree(initParent);
        const childOne = parent.zoom(into("one"));
        const childTwo = childOne.zoom(into("two"));
        const childThree = childTwo.zoom(into("three"));

        const called = {
          one: [] as Parent["one"][],
          two: [] as Parent["one"]["two"][],
          three: [] as number[],
          parent: [] as Parent[],
        };
        childOne.subscribe((newOne) => {
          called.one.push(newOne);
        });
        childTwo.subscribe((newTwo) => {
          called.two.push(newTwo);
        });
        childThree.subscribe((newThree) => {
          called.three.push(newThree);
        });
        parent.subscribe((newParent) => {
          called.parent.push(newParent);
        });

        parent.set(initParent);
        expect(called).toEqual({
          one: [initParent.one, initParent.one],
          two: [initParent.one.two, initParent.one.two],
          three: [initParent.one.two.three, initParent.one.two.three],
          parent: [initParent, initParent],
        });
      });
    });

    describe("when setting one of the writables which is both parent and child", () => {
      it("calls both its child subscribers, its parent subscribers, and the subscribers of itself", () => {
        type Parent = {
          one: {
            two: {
              three: number;
            };
          };
        };
        const initParent = {
          one: {
            two: {
              three: 0,
            },
          },
        };
        const parent = writableTree(initParent);
        const childOne = parent.zoom(into("one"));
        const childTwo = childOne.zoom(into("two"));
        const childThree = childTwo.zoom(into("three"));

        const called = {
          one: [] as Parent["one"][],
          two: [] as Parent["one"]["two"][],
          three: [] as number[],
          parent: [] as Parent[],
        };
        childOne.subscribe((newOne) => {
          called.one.push(newOne);
        });
        childTwo.subscribe((newTwo) => {
          called.two.push(newTwo);
        });
        childThree.subscribe((newThree) => {
          called.three.push(newThree);
        });
        parent.subscribe((newParent) => {
          called.parent.push(newParent);
        });

        childOne.set(initParent.one);
        childTwo.set(initParent.one.two);
        expect(called).toEqual({
          one: [initParent.one, initParent.one, initParent.one],
          two: [initParent.one.two, initParent.one.two, initParent.one.two],
          three: [
            initParent.one.two.three,
            initParent.one.two.three,
            initParent.one.two.three,
          ],
          parent: [initParent, initParent, initParent],
        });
      });

      it("doesn't call its siblings' subscribers", () => {
        type Parent = {
          one: {
            two: {
              three: number;
            };
            anotherTwo: {
              three: number;
            };
          };
        };
        const initParent = {
          one: {
            two: {
              three: 0,
            },
            anotherTwo: {
              three: 0,
            },
          },
        };
        const parent = writableTree(structuredClone(initParent));
        const childOne = parent.zoom(into("one"));
        const childTwo = childOne.zoom(into("two"));
        const childAnotherTwo = childOne.zoom(into("anotherTwo"));
        const childThree = childTwo.zoom(into("three"));
        const childAnotherThree = childAnotherTwo.zoom(into("three"));

        const called = {
          one: [] as Parent["one"][],
          two: [] as Parent["one"]["two"][],
          anotherTwo: [] as Parent["one"]["anotherTwo"][],
          three: [] as number[],
          anotherThree: [] as Parent["one"]["anotherTwo"]["three"][],
          parent: [] as Parent[],
        };
        childOne.subscribe((newOne) => {
          called.one.push(structuredClone(newOne));
        });
        childTwo.subscribe((newTwo) => {
          called.two.push(structuredClone(newTwo));
        });
        childAnotherTwo.subscribe((newAnotherTwo) => {
          called.anotherTwo.push(structuredClone(newAnotherTwo));
        });
        childThree.subscribe((newThree) => {
          called.three.push(newThree);
        });
        childAnotherThree.subscribe((newAnotherThree) => {
          called.anotherThree.push(newAnotherThree);
        });
        parent.subscribe((newParent) => {
          called.parent.push(structuredClone(newParent));
        });

        const setValue = { three: 2 };
        const newParent = {
          one: {
            ...initParent.one,
            two: setValue,
          },
        };
        childTwo.set(setValue);
        expect(called).toEqual({
          one: [initParent.one, newParent.one],
          two: [initParent.one.two, setValue],
          anotherTwo: [initParent.one.anotherTwo],
          three: [initParent.one.two.three, 2],
          anotherThree: [initParent.one.anotherTwo.three],
          parent: [initParent, newParent],
        });
      });
    });

    describe("when setting one of the child writables", () => {
      it("calls both the child subscribers and the parent subscribers", () => {
        type Parent = {
          child: {
            grandChild: number;
          };
        };
        const initParent = {
          child: {
            grandChild: 1,
          },
        };
        const parent = writableTree(initParent);
        const child = parent.zoom(into("child"));
        const grandChild = child.zoom(into("grandChild"));

        const called = {
          parent: [] as Parent[],
          child: [] as Parent["child"][],
          grandChild: [] as number[],
        };

        parent.subscribe((newParent) => {
          called.parent.push(structuredClone(newParent));
        });
        child.subscribe((newChild) => {
          called.child.push(structuredClone(newChild));
        });
        grandChild.subscribe((newGrandChild) => {
          called.grandChild.push(newGrandChild);
        });

        grandChild.update((n) => n + 1);
        expect(called).toEqual({
          parent: [{ child: { grandChild: 1 } }, { child: { grandChild: 2 } }],
          child: [{ grandChild: 1 }, { grandChild: 2 }],
          grandChild: [1, 2],
        });
      });

      it("doesn't call its siblings' subscribers", () => {
        type Parent = {
          one: number;
          two: number;
          three: number;
        };
        const initParent: Parent = {
          one: 1,
          two: 2,
          three: 3,
        };
        const parent = writableTree(structuredClone(initParent));
        const childOne = parent.zoom(into("one"));
        const childTwo = parent.zoom(into("two"));
        const childThree = parent.zoom(into("three"));

        const called = {
          one: [] as number[],
          two: [] as number[],
          three: [] as number[],
          parent: [] as Parent[],
        };

        childOne.subscribe((newOne) => {
          called.one.push(newOne);
        });
        childTwo.subscribe((newTwo) => {
          called.two.push(newTwo);
        });
        childThree.subscribe((newThree) => {
          called.three.push(newThree);
        });
        parent.subscribe((newParent) => {
          called.parent.push(structuredClone(newParent));
        });

        childOne.set(9);
        expect(called).toEqual({
          one: [1, 9],
          two: [2],
          three: [3],
          parent: [initParent, { ...initParent, one: 9 }],
        });
      });
    });
  });

  describe("choose", () => {
    it("calls subscribers only if the chooser doesn't refuse", () => {
      type ValueA = { type: "A"; value: number };
      type ValueB = { type: "B"; value: string };
      type Both = ValueA | ValueB | undefined;
      const init: Both = undefined;

      const both = writableTree<Both>(init);
      const a = both.choose((v) => (v?.type === "A" ? v : Refuse));
      const b = both.choose((v) => (v?.type === "B" ? v : Refuse));

      const called = {
        a: [] as ValueA[],
        b: [] as ValueB[],
        both: [] as Both[],
      };

      both.subscribe((v) => {
        called.both.push(v);
      });
      a.subscribe((v) => {
        called.a.push(v);
      });
      b.subscribe((v) => {
        called.b.push(v);
      });

      const setValue: ValueA = { type: "A", value: 100 };
      both.set(setValue);
      expect(called).toEqual({
        a: [setValue],
        b: [],
        both: [undefined, setValue],
      });
    });

    it("refuses initially non-matching value", () => {
      type OnlyPresent = { value: number };
      type Value = OnlyPresent | undefined;
      const init: Value = undefined;

      const value = writableTree<Value>(init);
      const onlyPresent = value.choose(isPresent);
      const internalValue = onlyPresent.zoom(into("value"));

      const called = {
        value: [] as Value[],
        onlyPresent: [] as OnlyPresent[],
        internalValue: [] as number[],
      };

      value.subscribe((v) => called.value.push(v));
      onlyPresent.subscribe((v) => called.onlyPresent.push(v));
      internalValue.subscribe((v) => called.internalValue.push(v));

      expect(called).toEqual({
        value: [init],
        onlyPresent: [],
        internalValue: [],
      });
    });

    describe("when the data has grand children", () => {
      type Value = { value: string; child: Child | undefined };
      type Child = {
        childValue: string;
        grandChild: GrandChild;
      };
      type GrandChild = {
        a: string;
        b: string;
      };

      type Called = {
        parent: Value[];
        maybeChild: (Child | undefined)[];
        child: Child[];
        grandChild: GrandChild[];
        a: string[];
        b: string[];
      };

      let init: Value;
      let initGrandChild: GrandChild;
      let called: Called;

      let parent: WritableTree<Value>;
      let maybeChild: WritableTree<Child | undefined>;
      let child: WritableTree<Child>;
      let grandChild: WritableTree<GrandChild>;
      let a: WritableTree<string>;
      let b: WritableTree<string>;

      beforeEach(() => {
        initGrandChild = {
          a: "initA",
          b: "initB",
        };
        init = {
          value: "initValue",
          child: {
            childValue: "initChildValue",
            grandChild: initGrandChild,
          },
        };

        called = {
          parent: [] as Value[],
          maybeChild: [] as (Child | undefined)[],
          child: [] as Child[],
          grandChild: [] as GrandChild[],
          a: [] as string[],
          b: [] as string[],
        };

        parent = writableTree(structuredClone(init));
        maybeChild = parent.zoom(into("child"));
        child = maybeChild.choose(isPresent);
        grandChild = child.zoom(into("grandChild"));
        a = grandChild.zoom(into("a"));
        b = grandChild.zoom(into("b"));

        parent.subscribe((v) => {
          called.parent.push(structuredClone(v));
        });
        maybeChild.subscribe((v) => {
          called.maybeChild.push(structuredClone(v));
        });
        child.subscribe((v) => {
          called.child.push(structuredClone(v));
        });
        grandChild.subscribe((v) => {
          called.grandChild.push(structuredClone(v));
        });
        a.subscribe((v) => {
          called.a.push(v);
        });
        b.subscribe((v) => {
          called.b.push(v);
        });
      });

      it("properly propagates changes to the descendants 1", () => {
        const setChild = {
          childValue: "newChildValue",
          grandChild: {
            a: "newA",
            b: "newB",
          },
        };
        maybeChild.set(undefined);
        maybeChild.set(setChild);
        expect(called).toEqual({
          parent: [
            init,
            { ...init, child: undefined },
            { ...init, child: setChild },
          ],
          maybeChild: [init.child, undefined, setChild],
          child: [init.child, setChild],
          grandChild: [init.child!.grandChild, setChild.grandChild],
          a: [initGrandChild.a, setChild.grandChild.a],
          b: [initGrandChild.b, setChild.grandChild.b],
        });
      });

      it("properly propagates changes to the descendants 2", () => {
        const set1 = {
          value: "value1",
          child: undefined,
        };
        parent.set(set1);

        const set2 = {
          value: "value2",
          child: {
            childValue: "childValue2",
            grandChild: {
              a: "A2",
              b: "B2",
            },
          },
        };
        parent.set(set2);

        expect(called).toEqual({
          parent: [init, set1, set2],
          maybeChild: [init.child, set1.child, set2.child],
          child: [init.child, set2.child],
          grandChild: [init.child!.grandChild, set2.child!.grandChild],
          a: ["initA", "A2"],
          b: ["initB", "B2"],
        });
      });
    });

    test("writables returned by the `choose()` can update the store value", () => {
      type Value = { value: string | undefined };
      const storeValue: Value = { value: undefined };
      const value = writableTree<Value>(storeValue);
      const onlyPresent = value.zoom(into("value")).choose((v) => v ?? Refuse);

      const called = {
        value: [] as Value[],
        onlyPresent: [] as Value['value'][],
      };

      value.subscribe((v) => called.value.push(v));
      onlyPresent.subscribe((v) => called.onlyPresent.push(v));

      const setValue = "setValue";
      onlyPresent.set(setValue);

      expect(called).toEqual({
        value: [storeValue, storeValue],
        onlyPresent: [setValue],
      });
      expect(storeValue).toEqual({
        value: setValue,
      });
    });

  });
});

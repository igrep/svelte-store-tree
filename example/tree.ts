import { Refuse, writableTree } from "../src/index";
import type { WritableTree } from "../src/index";

export type KeyValue = {
  key: string;
  value: string;
};

export type Tree = string | undefined | KeyValue | Tree[];

export const tree = writableTree<Tree>([
  "foo",
  "bar",
  ["baz1", "baz2", "baz3"],
  undefined,
  { key: "some key", value: "some value" },
]);

export type NodeType = "string" | "undefined" | "KeyValue" | "List";

export function changeNodeType(tree: WritableTree<Tree>, typ: NodeType): void {
  let newNode: Tree;
  switch (typ) {
    case "undefined":
      newNode = undefined;
      break;
    case "string":
      newNode = "";
      break;
    case "KeyValue":
      newNode = { key: "", value: "" };
      break;
    case "List":
      newNode = [""];
      break;
  }
  tree.set(newNode);
}

export function appendTo(ls: WritableTree<Tree[]>, typ: NodeType): void {
  let newNode: Tree;
  switch (typ) {
    case "undefined":
      newNode = undefined;
      break;
    case "string":
      newNode = "";
      break;
    case "KeyValue":
      newNode = { key: "", value: "" };
      break;
    case "List":
      newNode = [""];
      break;
  }
  ls.update((l) => {
    l.push(newNode);
    return l;
  });
}

export function chooseKeyValue(tree: Tree): KeyValue | Refuse {
  if (tree === undefined || typeof tree === "string" || tree instanceof Array) {
    return Refuse;
  }
  return tree;
}

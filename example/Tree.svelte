<script lang="ts">
  import { Refuse, choose, into, type WritableTree } from "../src";
  import { appendTo, changeNodeType, chooseKeyValue } from "./tree";
  import type { Tree, NodeType } from "./tree";
  import NodeTypeSelector from "./NodeTypeSelector.svelte";

  export let tree: WritableTree<Tree>;

  const list = tree.zoom(
    choose((t) => t instanceof Array ? t : Refuse)
  );

  const keyValue = tree.zoom(choose(chooseKeyValue));
  const key = keyValue.zoom(into("key"));
  const value = keyValue.zoom(into("value"));

  let selected: NodeType | undefined;

  function onSelected() {
    if (selected === undefined) {
      return;
    }
    changeNodeType(tree, selected);
    selected = undefined;
  }

  function onNewNodeTypeSelected() {
    if (selected === undefined) {
      return;
    }
    appendTo(list, selected);
    selected = undefined;
  }
</script>

{#if typeof $tree === "string"}
  <li>
    <NodeTypeSelector label="Switch" bind:selected {onSelected} /><input
      type="text"
      bind:value={$tree}
    />
  </li>
{:else if $tree === undefined}
  <li>
    <NodeTypeSelector
      label="Switch"
      bind:selected
      {onSelected}
    />&lt;Nothing&gt;
  </li>
{:else if $tree instanceof Array}
  <NodeTypeSelector label="Switch" bind:selected {onSelected} />
  <ul>
    {#each $tree as _subTree, i (i)}
      <svelte:self tree={list.zoom(into(i))} />
    {/each}
    <li>
      <NodeTypeSelector
        label="Add"
        bind:selected
        onSelected={onNewNodeTypeSelected}
      />
    </li>
  </ul>
{:else}
  <li>
    <NodeTypeSelector label="Switch" bind:selected {onSelected} />
    <dl>
      <dt><input type="text" bind:value={$key} /></dt>
      <dd><input type="text" bind:value={$value} /></dd>
    </dl>
  </li>
{/if}

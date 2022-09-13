<script lang="ts">
  import { Refuse, type WritableTree } from "../src";
  import { appendTo, chooseKeyValue } from "./tree";
  import type { Tree, KeyValue, AppendType } from "./tree";

  export let tree: WritableTree<Tree>;

  const list = tree.chooseWritable<Tree[]>((t) => t instanceof Array ? t : Refuse);

  const keyValue = tree.chooseWritable<KeyValue>(chooseKeyValue);
  const key = keyValue.zoomInWritable("key");
  const value = keyValue.zoomInWritable("value");

  let selected: AppendType | undefined;

  function onChange() {
    if (selected === undefined) {
      return;
    }
    appendTo(list, selected);
    selected = undefined;
  }
</script>

{#if typeof $tree === "string"}
  <li><input type="text" bind:value={$tree} /></li>
{:else if $tree === undefined}
  <li>&lt;NO DATA&gt;</li>
{:else if $tree instanceof Array}
  <ul>
    {#each $tree as _subTree, i (i)}
      <svelte:self tree={list.zoomInWritable(i)} />
    {/each}
    <li>
      <select bind:value={selected} on:change={onChange}>
        <option value={undefined}>+</option>
        <option value="Tree">New Tree</option>
        <option value="KeyValue">New KeyValue</option>
        <option value="string">New String</option>
        <option value="undefined">New Nothing</option>
      </select>
    </li>
  </ul>
{:else}
  <li>
    <dl>
      <dt><input type="text" bind:value={$key} /></dt>
      <dd><input type="text" bind:value={$value} /></dd>
    </dl>
  </li>
{/if}

<script lang="ts">
  import type { NodeType } from "./tree";

  export let label: string;
  export let selected: NodeType | undefined = undefined;
  export let onSelected: () => void;
</script>

<select bind:value={selected} on:change={onSelected}>
  <option value={undefined}>{label}</option>
  <option value="List">List</option>
  <option value="KeyValue">KeyValue</option>
  <option value="string">String</option>
  <option value="undefined">Nothing</option>
</select>

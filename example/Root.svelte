<script lang="ts">
  import TreeComponent from "./Tree.svelte";
  import { tree, type NodeType, type Tree } from "./tree";

  $: stats = countByNode($tree);
  function countByNode(node: Tree): Map<NodeType, number> {
    const stats = new Map<NodeType, number>();
    function go(n: Tree) {
      let key: NodeType;
      if (n === undefined) {
        key = 'undefined';
        stats.set(key, (stats.get(key) ?? 0) + 1);
        return;
      }
      if (typeof n === 'string'){
        key = 'string';
        stats.set(key, (stats.get(key) ?? 0) + 1);
        return;
      }
      if (n instanceof Array) {
        key = 'List';
        stats.set(key, (stats.get(key) ?? 0) + 1);
        for (const child of n) {
          go(child);
        }
        return;
      }
      key = 'KeyValue';
      stats.set(key, (stats.get(key) ?? 0) + 1);
    }
    go(node);
    return stats;
  }
</script>

<table>
  <tr>
    <th>Node Type</th>
    <th>Count</th>
  </tr>
    {#each Array.from(stats) as [nodeType, count]}
  <tr>
      <td>{nodeType}</td>
      <td>{count}</td>
  </tr>
    {/each}
</table>
<hr>
<TreeComponent {tree}/>

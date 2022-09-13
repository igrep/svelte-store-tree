import Tree from './Tree.svelte';
import { tree } from './tree';

const app = new Tree({
  target: document.getElementById('app')!,
  props: { tree }
});

export default app;

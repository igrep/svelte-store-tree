# v0.3.2

- Include the `.ts` file in the distribution for better debugging experience.

# v0.3.1

- Breaking changes:
    - Re-design the API from scratch:
        - Now `zoom` and `zoomNoSet` are the only APIs that `ReadableTree`/`WriteableTree` adds to `Readable`/`Writable`.
            - `zoom` accepts an `Accessor` object, which contains `readChild` and `writeChild`.
            - `zoomNoSet` accepts a `readChild` function to return `ReadableTree`.
        - New `Accessor` class can replace `zoomIn`, `choose`, etc, and it's composable with the `and` method.
        - `ReadableTree` is now "writable" in its children: `ReadableTree`'s `zoom`ed tree can be `set`.
- 📝 Documentation changes etc:
    - Update the description to include "nested stores" as its keyword
    - Add how to install

# v0.2.1

- `svelte` should always be in `devDependencies`
    - <https://github.com/igrep/svelte-store-tree/commit/610309312899c902f509b12574b14764941cabfb>
    - Thanks for answering in the Discord thread!
        - <https://discord.com/channels/457912077277855764/1022378344681050222/1022380368634064948>
- Drop `set`, `zoomWritable`, `zoomInWritable` and `chooseWritable` from the return object of `zoom`, `zoomIn`, and `choose`.
    - <https://github.com/igrep/svelte-store-tree/commit/57780e88297b48b926cc185b84312d207ba88a95>

# v0.1.1

Initial release.

import { assembleApplication } from "./src/assembly.ts";

export default {
  assemble: assembleApplication,
  title: "Relay Three-Concept Incremental Assembly",
  design: {
    version: 1,
    documents: [new URL("./design/types.incremental-three-concepts.md", import.meta.url)],
  },
};

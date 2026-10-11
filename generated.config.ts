import { assembleApplication } from "./src/assembly.ts";

export default {
  assemble: assembleApplication,
  title: "Relay ProcedureMaintaining and ContextTracking Increment",
  design: {
    version: 1,
    documents: [new URL("./design/types.incremental-two-concepts.md", import.meta.url)],
  },
};

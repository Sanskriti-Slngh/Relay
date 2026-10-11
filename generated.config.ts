import { assembleApplication } from "./src/assembly.ts";

export default {
  assemble: assembleApplication,
  title: "Relay ProcedureMaintaining Increment",
  design: {
    version: 1,
    documents: [new URL("./design/types.procedure-incremental.md", import.meta.url)],
  },
};

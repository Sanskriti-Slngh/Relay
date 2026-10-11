import { assembleApplication } from "./src/assembly.ts";

export default {
  assemble: assembleApplication,
  title: "Relay Four-Concept Incremental Assembly",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Relay.md", import.meta.url),
    ],
  },
};

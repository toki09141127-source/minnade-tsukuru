/* eslint-disable @typescript-eslint/no-require-imports */
// Local verification loader. Never bundled in the app; keeps server-only enforcement in production builds.
const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  ts = require("typescript"),
  cache = new Map();
module.exports = function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module: m,
      exports: m.exports,
      require: (name) =>
        name === "server-only"
          ? {}
          : name.startsWith("@/")
            ? load(name.replace("@/", "") + ".ts")
            : name.startsWith(".")
              ? load(
                  path.posix.normalize(
                    path.posix.join(path.posix.dirname(file), name),
                  ) + ".ts",
                )
              : require(name),
      process,
      fetch,
      URL,
      Date,
      Set,
      Map,
      Error,
      AbortSignal,
      Buffer,
      setTimeout,
      clearTimeout,
    },
    { filename: file },
  );
  return m.exports;
};

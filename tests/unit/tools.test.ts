import { describe, expect, it } from "vitest";
import { windowsCommandLine, winQuote } from "../../scripts/db/tools";

/** `npm run dev` on Windows: the tool's .cmd runs through cmd.exe, as one quoted command line */
describe("starting tools on Windows", () => {
  it("quotes the tool's path, so a folder name with spaces still works", () => {
    expect(
      windowsCommandLine("C:\\Users\\Dr Zakir\\zalfiweb\\node_modules\\.bin\\next.cmd", ["dev"]),
    ).toBe('"C:\\Users\\Dr Zakir\\zalfiweb\\node_modules\\.bin\\next.cmd" dev');
  });

  it("leaves plain arguments alone and quotes the rest", () => {
    expect(winQuote("-p")).toBe("-p");
    expect(winQuote("3001")).toBe("3001");
    expect(winQuote("scripts/db/neon-local-proxy.ts")).toBe("scripts/db/neon-local-proxy.ts");
    expect(winQuote("--config=vitest.db.config.mts")).toBe("--config=vitest.db.config.mts");
    expect(winQuote("my file.ts")).toBe('"my file.ts"');
    expect(winQuote("a&b")).toBe('"a&b"');
    expect(winQuote('say "hi"')).toBe('"say \\"hi\\""');
  });
});

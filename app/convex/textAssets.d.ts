// Files with a .txt extension are bundled by esbuild (and the vitest
// textAssets plugin) as their raw text. Used for large JSON data that is
// parsed lazily — see survivalSessions.ts.
declare module "*.txt" {
  const text: string;
  export default text;
}

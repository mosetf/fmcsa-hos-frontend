declare module "next/types.js" {
  export type ResolvingMetadata = unknown;
  export type ResolvingViewport = unknown;
}

declare module "next/dynamic" {
  const dynamic: <T>(loader: () => Promise<T>, options?: { ssr?: boolean; loading?: () => JSX.Element }) => T;
  export default dynamic;
}

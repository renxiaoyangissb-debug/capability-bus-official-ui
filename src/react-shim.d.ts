declare module "react" {
  export const StrictMode: (props: { children?: unknown }) => unknown;
  export function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((current: T) => T)) => void];
}

declare module "react-dom/client" {
  export function createRoot(element: Element): { render(node: unknown): void };
}

declare module "react/jsx-runtime" {
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
  export const Fragment: unknown;
}

declare namespace JSX {
  interface IntrinsicElements { [name: string]: Record<string, unknown>; }
}

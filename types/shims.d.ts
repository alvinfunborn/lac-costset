declare module 'react' {
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useRef<T>(initial?: T): { current: T | null };
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T;
  export const Fragment: any;
  const React: any;
  export default React;
}

declare module 'react-dom/client' {
  export type Root = { render: (node: any) => void; unmount: () => void };
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare namespace React {
  interface FC<P = any> {
    (props: P & { children?: any }): any;
  }
}


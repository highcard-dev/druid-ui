import type { Props } from "druid:ui/ui";
import type { Event } from "../types";
import type { Context } from "druid:ui/component";
export declare function fnv1aHash(str: string): string;
export declare const eventMap: Record<string, Record<string, Function>>;
export declare function emit(nodeid: string, event: string, e: Event): void;
export declare const createDFunc: (dfunc: (element: string, props: Props, children: string[]) => string) => (tag: string | {
    view: (props?: any) => void;
} | ((props?: any) => void), props?: Record<string, any>, ...children: string[]) => string | void;
export declare const asyncCallback: (id: string, result: {
    tag: "ok" | "err";
    val: any;
}) => void;
export declare const rawAsyncToPromise: <T>(fn: (...args: any[]) => any) => (...args: any[]) => Promise<T>;
export declare const createComponent: (j: (ctx: Context) => string | JSX.Element) => {
    init: (ctx: Context) => string | JSX.Element;
    emit: typeof emit;
    asyncComplete: (id: string, result: {
        tag: "ok" | "err";
        val: any;
    }) => void;
};

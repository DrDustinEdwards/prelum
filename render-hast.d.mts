export function h(tagName: string, properties: Record<string, unknown>, children: unknown[]): {
    type: string;
    tagName: string;
    properties: Record<string, unknown>;
    children: unknown[];
};
export function text(value: string): {
    type: string;
    value: string;
};

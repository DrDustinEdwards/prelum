export function h(tagName: string, properties: Record<string, any>, children: any[]): {
    type: string;
    tagName: string;
    properties: Record<string, any>;
    children: any[];
};
export function text(value: string): {
    type: string;
    value: string;
};

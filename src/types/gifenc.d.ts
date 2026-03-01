declare module 'gifenc' {
    export function GIFEncoder(): {
        writeFrame(
            index: Uint8Array,
            width: number,
            height: number,
            opts?: {
                palette?: number[][],
                delay?: number,
                repeat?: 0, // 0 forces an infinite loop
                transparent?: boolean,
                transparentIndex?: number,
                dispose?: number
            }
        ): void;
        finish(): void;
        bytesView(): Uint8Array;
    };

    export function applyPalette(
        rgba: Uint8Array | Uint8ClampedArray,
        palette: number[][],
        format?: string
    ): Uint8Array;

    export function quantize(
        rgba: Uint8Array | Uint8ClampedArray,
        maxColors: number,
        options?: any
    ): number[][];
}

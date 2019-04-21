export class Color {
    public font: number = 0;
    public back: number = 0;

    private _colorHex = [
        "#000000", // black
        "#cd0000", // red3
        "#00cd00", // green3
        "#cdcd00", // yellow3
        "#0000ee", // blue2
        "#cd00cd", // magenta3
        "#00cdcd", // cyan3
        "#e5e5e5", // gray90
        "#7f7f7f", // gray50
        "#ff0000", // red
        "#00ff00", // green
        "#ffff00", // yellow
        "#5c5cff", // rgb:5c/5c/ff
        "#ff00ff", // magenta
        "#00ffff", // cyan
        "#ffffff"  // white
    ];

    constructor( font: number | number[] = 0, back: number = 0 ) {
        if ( Array.isArray( font ) && back === 0 ) {
            this.font = font[0];
            this.back = font[1];
        } else {
            this.font = font as number;
            this.back = back;
        }
    }

    get fontHex() {
        return this._colorHex[ this.font ] || "normal";
    }

    get backHex() {
        return this._colorHex[ this.font ] || "normal";
    }

    get number() {
        return (this.font * 16) + this.back;
    }
}

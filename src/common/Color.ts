export class Color {
    public font: number = 0;
    public back: number = 0;

    /*
        default: -1,
        normal: -1,
        // normal
        black: 0,
        red: 1,
        green: 2,
        yellow: 3,
        blue: 4,
        magenta: 5,
        cyan: 6,
        white: 7,
        // light
        lightblack: 8,
        lightred: 9,
        lightgreen: 10,
        lightyellow: 11,
        lightblue: 12,
        lightmagenta: 13,
        lightcyan: 14,
        lightwhite: 15,
        // bright
        brightblack: 8,
        brightred: 9,
        brightgreen: 10,
        brightyellow: 11,
        brightblue: 12,
        brightmagenta: 13,
        brightcyan: 14,
        brightwhite: 15,
        // alternate spellings
        grey: 8,
        gray: 8,
        lightgrey: 7,
        lightgray: 7,
        brightgrey: 7,
        brightgray: 7
    */

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

    private _colorName = [
        "black",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
        "cyan",
        "white",
        "lightblack", // gray
        "lightred",
        "lightgreen",
        "lightyellow",
        "lightblue",
        "lightmagenta",
        "lightcyan",
        "lightwhite"
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

    hexBlessFormat(text) {
        return text ? `{${this.fontHex}-fg}{${this.backHex}-bg}${text}{/}{/}` : text;
    }

    fontHexBlessFormat(text) {
        return text ? `{${this.fontHex}-fg}${text}{/}` : text;
    }

    backHexBlessFormat(text) {
        return text ? `{${this.fontHex}-bg}${text}{/}` : text;
    }

    reverse() {
        return new Color( this.back, this.font );
    }

    get backHexBlesssed() {
        return "#" + (this._colorHex[ this.back ] || "normal") + "-bg";
    }

    get fontHex() {
        return this._colorHex[ this.font ] || "normal";
    }

    get backHex() {
        return this._colorHex[ this.back ] || "normal";
    }

    get backColorName() {
        return this._colorName[ this.back ] || "normal";
    }

    get fontColorName() {
        return this._colorName[ this.font ] || "normal";
    }

    get number() {
        return (this.font * 16) + this.back;
    }

    get blessed() {
        return {
            fg: this.fontColorName,
            bg: this.backColorName
        };
    }

    get blessedReverse() {
        return {
            bg: this.fontColorName,
            fg: this.backColorName
        };
    }
}

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

const COLOR_NAME = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "light-black", // gray
    "light-red",
    "light-green",
    "light-yellow",
    "light-blue",
    "light-magenta",
    "light-cyan",
    "light-white"
];

export class Color {
    public font: number = 0;
    public back: number = 0;

    constructor( font: number | number[] = 0, back: number = 0 ) {
        if ( Array.isArray( font ) && back === 0 ) {
            this.font = font[0];
            this.back = font[1];
        } else {
            this.font = font as number;
            this.back = back;
        }
    }

    blessFormat(text) {
        return text ? `{${this.font}-fg}{${this.back}-bg}${text}{/}{/}` : text;
    }

    blessReverseFormat(text) {
        return text ? `{${this.font}-fg}{${this.back}-bg}${text}{/}{/}` : text;
    }

    fontBlessFormat(text) {
        return text ? `{${this.font}-fg}${text}{/}` : text;
    }

    backBlessFormat(text) {
        return text ? `{${this.back}-bg}${text}{/}` : text;
    }

    reverse() {
        return new Color( this.back, this.font );
    }

    get backStrBlesssed() {
        return "#" + (COLOR_NAME[ this.back ] || "normal") + "-bg";
    }

    get backColorName() {
        return COLOR_NAME[ this.back ] || "normal";
    }

    get fontColorName() {
        return COLOR_NAME[ this.font ] || "normal";
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

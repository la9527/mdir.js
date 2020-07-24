import { sprintf } from "sprintf-js";
import { strWidth, isSurrogate, charWidth } from "neo-blessed/lib/unicode";
import { Logger } from "./Logger";

const log = Logger("StringUtils");

export class StringUtils {
    static toregular(num: any ) {
        const reg = /(^[+-]?\d+)(\d{3})/;
        const number = parseInt(num, 10);
        if ( isNaN(number) ) {
            return "0";
        }
        let ret = number + "";
        while (reg.test(ret)) {
            ret = ret.replace(reg, "$1,$2");
        }
        return ret;
    }

    static sizeConvert( size: number, color: boolean = true, digit = 2 ) {
        let textSize = null;
        if ( size >= 1000000000000 ) {
            textSize = sprintf("%9." + digit + "f" + (color ? "{yellow-fg}T{/yellow-fg}" : "T"), size / 1099511627776);
        } else if (size >= 1000000000) {
            textSize = sprintf("%9." + digit + "f" + (color ? "{yellow-fg}G{/yellow-fg}" : "G"), size / 1073741824);
        } else if ( size >= 10000000) {
            textSize = sprintf("%9." + digit + "f" + (color ? "{yellow-fg}M{/yellow-fg}" : "M"), size / 1048576);
        } else {
            textSize = sprintf("%10s", StringUtils.toregular(size));
        }
        return textSize;
    }

    static ellipsis( text: string, maxWidth: number ) {
        if ( !text ) {
            return null;
        }
        if ( text.length <= maxWidth ) {
            return text;
        }
        let cutPos = Math.floor(maxWidth / 2);
        return text.substr(0, cutPos - 3) + "..." + text.substr( text.length - cutPos );
    }

    static scrSubstr( text: string, firstPos: number, len: number = -1 ) {
        let strlen = 0;
        let resText = "";

        if (!text || firstPos < 0 || firstPos >= strWidth(text) || len === 0) {
            return resText;
        }

        let width = 0;
        for (let i = 0; i < text.length; i++) {
            width += charWidth(text, i);
            if ( width > firstPos ) {
                strlen = width - firstPos;
                resText += text[i];
            }
            if (isSurrogate(text, i)) {
                i++;
            }
            if ( len > -1 && strlen >= len ) break;
        }
        return resText;
    }
    
    // ("123456", 3, 1) ==> "12456"
    // ("123456", 3, "7") ==> "123756"
    // ("123456", 3, "7", true) ==> "1237456"
    // ("1", 0, 1) ===> ""
    static scrStrReplace( text: string, firstPos: number, removeLenChStr: string | number = -1, isInsert: boolean = false ): string {
        let resultText = StringUtils.scrSubstr(text, 0, firstPos);
        if ( typeof(removeLenChStr) == "string" ) {
            if ( isInsert ) {
                return resultText + removeLenChStr + StringUtils.scrSubstr(text, firstPos);
            }
            return resultText + removeLenChStr + StringUtils.scrSubstr(text, firstPos + strWidth(removeLenChStr));
        }
        if ( !resultText ) {
            return resultText;
        }
        return resultText + StringUtils.scrSubstr(text, firstPos + removeLenChStr);
    }
}

export interface IToken {
    text: string;
    pos: number;
    nextLine: boolean;
}

export class StringLineToken {
    private _source: string = "";
    private _sourceLen: number = 0;

    private _width: number;
    private _curLine: number;

    private _curStr: string = "";
    private _lastStr: string = "";
    private _pos: number = 0;
    private _nextLine: boolean = false;

    get curLine() {
        return this._curLine;
    }

    get width() {
        return this._width;
    }

    get source() {
        return this._source;
    }

    private update() {
        this._sourceLen = strWidth(this._lastStr);
        if ( this._sourceLen <= this._width ) {
            this._curStr = this._lastStr;
            this._lastStr = "";
            this._nextLine = false;
        } else {
            this._curStr = StringUtils.scrSubstr( this._lastStr, 0, this._width );
            this._lastStr = this._lastStr.substr(this._curStr.length);
            this._nextLine = true;
        }
        
        //console.log( `pos:${this._pos};len:${this._sourceLen};str[${this._curStr}];last[${this._lastStr}];` );
    }

    setString( source: string, viewWidth = 80 ) {
        this._source = source;
        this._lastStr = source;
        this._width = viewWidth;
        this._pos = 0;
        this._curLine = 0;
        if ( !source ) {
            return;
        }
        this.update();
    }

    getToken() {
        return { text: this._curStr || "", pos: this._pos || 0, nextLine: this._nextLine };
    }

    get() {
        return this._curStr || "";
    }

    getPos() {
        return this._pos || 0;
    }

    next(isCheckOnly: boolean = false): boolean {
        if ( !isCheckOnly ) {
            this._pos += this._curStr.length;
            this._curLine++;
            this.update();
        }
        return this._curStr.length > 0;
    }
}
/*
export class StringLineToken2 {
    private tokens: IToken[] = [];
    private _source: string = null;

    private _width: number;
    private _curLine: number;

    get curLine() {
        return this._curLine;
    }

    get width() {
        return this._width;
    }

    get source() {
        return this._source;
    }

    setString( source: string, viewWidth = 80 ) {
        let nextLine = false;
        let line = null;
        let viewStr = null;
        let lineStr = source;
        
        this._source = source;
        this.tokens = [];
        this._width = viewWidth;
        this._curLine = 0;

        if ( !source ) {
            return;
        }

        let pos = 0;
        do {
            let strlen = strWidth(lineStr);
            if ( strlen <= viewWidth ) {
                viewStr = lineStr;
                nextLine = false;
            } else {
                viewStr = StringUtils.scrSubstr( lineStr, 0, viewWidth );
                lineStr = StringUtils.scrSubstr( lineStr, viewWidth, strlen - viewWidth );
                nextLine = true;
            }
            this.tokens.push( { text: viewStr, pos, nextLine } );
            pos += viewStr.length;
        } while( nextLine );
    }

    getToken() {
        return this.tokens[this._curLine];
    }

    get() {
        if ( this.tokens[this._curLine] ) {
            return "";
        }
        return this.tokens[this._curLine].text || "";
    }

    getPos() {
        if ( this.tokens[this._curLine] ) {
            return 0;
        }
        return this.tokens[this._curLine].pos || 0;
    }

    size() {
        return this.tokens.length;
    }

    next(isCheckOnly: boolean = false): boolean {
        if ( this.tokens.length > this._curLine ) {
            if ( !isCheckOnly ) {
                this._curLine++;
            }
            return true;
        }
        return false;
    }
}
*/
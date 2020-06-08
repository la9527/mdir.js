import { sprintf } from "sprintf-js";

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
        if (size >= 1000000000) {
            textSize = sprintf("%9." + digit + "f" + (color ? "{yellow-fg}G{/yellow-fg}" : "G"), size / 1073741824);
        } else if ( size >= 10000000) {
            textSize = sprintf("%9." + digit + "f" + (color ? "{yellow-fg}M{/yellow-fg}" : "M"), size / 1048576);
        } else if ( size >= 10000) {
            textSize = sprintf("%9." + digit + "f" + (color ? "{yellow-fg}K{/yellow-fg}" : "K"), size / 1024);
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
}

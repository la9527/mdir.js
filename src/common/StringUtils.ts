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

     static sizeConvert( size: number ) {
        let textSize = null;
        if (size >= 1000000000) {
            textSize = sprintf("%9.2f{yellow-fg}G{/yellow-fg}", size / 1073741824);
        } else if ( size >= 10000000) {
            textSize = sprintf("%9.2f{yellow-fg}M{/yellow-fg}", size / 1048576);
        } else {
            textSize = sprintf("%10s", StringUtils.toregular(size));
        }
        return textSize;
     }
}

import blessed from "neo-blessed";
import { charWidth } from "neo-blessed/lib/unicode.js";
import { sprintf } from "sprintf-js";

export function screenPrintf( parent, y, x ) {
    const element = blessed.text({
        parent,
        tags: true,
        left: x,
        top: y
    });
    const printfOptions = [];
    if ( arguments.length > 3 ) {
        for ( let i = 3; i < arguments.length; i++ ) {
            // eslint-disable-next-line prefer-rest-params
            printfOptions.push( arguments[i] );
        }
    }
    element.setContent( sprintf.call( screenPrintf, printfOptions ) );
    return element;
}

export function scrstrncpy( str: string, pos: number, len: number ) {
    let result = "";
    let size = 0;
    for ( let i = pos; i < str.length; i++ ) {
        if ( size >= len ) {
            break;
        }
        size += charWidth( str.charAt(i) );
        result += str.charAt(i);
    }
    return result;
}

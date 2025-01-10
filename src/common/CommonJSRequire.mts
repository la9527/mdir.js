import { createRequire } from "module";

export function CJSRequire( path: string ) {
    const result = createRequire( import.meta.url )( path );
    return result?.default || result;
}

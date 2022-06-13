import { Reader } from "../common/Reader.mjs";
import { FileReader } from "./FileReader.mjs";

export function readerControl(fstype: string): Reader {
    if ( fstype === "file" ) {
        return new FileReader();
    }
    return null;
}

import { Reader } from "../common/Reader";
import { FileReader } from "./FileReader";

export function readerControl(fstype: string): Reader {
    if ( fstype === "file" ) {
        return new FileReader();
    }
    return null;
}

import { Color } from "./Color";
import * as path from "path";

export interface FileLink {
    name: string;
    file: File;
}

export class File {
    fstype:     string;
    root:       string;
    fullname:   string;
    name:       string;
    size:       number;
    dir:        boolean;
    attr:       string;

    owner:      string;
    group:      string;
    ctime:      Date;       // create time
    mtime:      Date;       // modify time

    select:     boolean;

    color:      Color = new Color();
    link:       FileLink = null;

    error:      any = null; // reading fail.

    get extname() {
        return path.extname(this.fullname);
    }

    equal(file: File) {
        return file.fullname === this.fullname;
    }
}

import { Color } from "./Color";
import * as path from "path";

export class FileLink {
    name: string;
    file: File;

    constructor( name = null, file = null ) {
        this.name = name;
        this.file = file;
    }

    clone(): FileLink {
        const link = new FileLink();
        link.name = this.name;
        link.file = this.file && this.file.clone();
        return link;
    }
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
    uid:        number;
    gid:        number;
    ctime:      Date;       // create time
    mtime:      Date;       // modify time

    select:     boolean;

    color:      Color = new Color();
    link:       FileLink = null;

    error:      any = null; // reading fail.

    mimetype:   string = null;

    get dirname() {
        return path.dirname(this.fullname);
    }

    get extname() {
        return path.extname(this.fullname);
    }

    equal(file: File) {
        return file.fullname === this.fullname;
    }

    clone(): File {
        let renew = new File();
        renew.attr = this.attr;
        renew.color = this.color;
        renew.dir = this.dir;
        renew.name = this.name;
        renew.fullname = this.fullname;
        renew.owner = this.owner;
        renew.group = this.group;
        renew.gid = this.gid;
        renew.uid = this.uid;
        renew.fstype = this.fstype;
        renew.link = this.link && this.link.clone();
        renew.error = this.error;
        renew.mimetype = this.mimetype;
        return renew;
    }
}

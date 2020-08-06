import { Color } from "./Color";
import * as path from "path";
import { sprintf } from "sprintf-js";
import { ColorConfig } from "../config/ColorConfig";

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
    atime:      Date;       // access time

    orgname:    string;

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

    convertColor() {
        this.color = ColorConfig.instance().getFileColor( this );
    }

    clone(): File {
        let renew = new File();
        renew.fstype = this.fstype;
        renew.root = this.root;
        renew.fullname = this.fullname;
        renew.name = this.name;
        renew.size = this.size;
        renew.dir = this.dir;
        renew.attr = this.attr;

        renew.owner = this.owner;
        renew.group = this.group;
        renew.gid = this.gid;
        renew.uid = this.uid;
        renew.ctime = this.ctime;
        renew.mtime = this.mtime;
        renew.atime = this.atime;
        
        renew.orgname = this.orgname;

        renew.color = this.color;
        renew.link = this.link && this.link.clone();
        renew.error = this.error;
        renew.mimetype = this.mimetype;        
        return renew;
    }

    toString() {
        if ( this.owner && this.group ) {
            return sprintf("%s %s %s %s %-10d %s", this.fstype, this.attr, this.owner, this.group, this.size, this.fullname);
        } else {
            return sprintf("%s %s %10d %s", this.fstype, this.attr, this.size, this.fullname);
        }
    }
}

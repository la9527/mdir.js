import { Color } from "./Color.mjs";
import path from "path";
import { sprintf } from "sprintf-js";
import { ColorConfig } from "../config/ColorConfig.mjs";

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

    extendInfo: any = null;

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
        const renew = new File();
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
        renew.extendInfo = this.extendInfo;
        return renew;
    }

    toString() {
        try {
            if ( this.owner && this.group ) {
                return sprintf("%s %s %s %s %-10d %s", this.fstype, this.attr, this.owner, this.group, this.size || 0, this.fullname);
            } else {
                return sprintf("%s %s %10d %s", this.fstype, this.attr, this.size || 0, this.fullname);
            }
        } catch( e ) {
            return this.fullname;
        }
    }

    static fromJson(json: any) {
        try {
            return Object.assign( new File, json );
        } catch( e ) {
            console.error( e );
            return null;
        }
    }
}

import { File } from "../common/File";

export class Dir {
    public file: File = null;
    public depth: number = -1;
    public row: number = -1;
    public index: number = -1;

    public parentDir: Dir = null;
    public check: boolean = false;

    public subDir: Dir[] = [];

    constructor( file: File, parentDir: Dir = null, check: boolean = false ) {
        this.file = file;
        this.parentDir = parentDir;
        this.check = check;
        this.depth = this.parentDir ? this.parentDir.depth + 1 : 0;
    }

    toJSON() {
        return {
            file: this.file,
            depth: this.depth,
            row: this.row,
            index: this.index,
            check: this.check,
            parentIndex: this.parentDir ? this.parentDir.index : -1
        };
    }
}

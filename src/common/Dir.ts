import { File } from '../common/File';

export class Dir {
    public file: File = null;
    public depth: number = -1;
    public row: number = -1;
    public index: number = -1;

    public parentDir: Dir = null;
    public check: boolean = false;

    public subDir: Dir[] = [];

    constructor( file: File, parentDir: Dir, check: boolean = false ) {
        this.file = file;
        this.parentDir = parentDir;
        this.check = check;
        this.depth = this.parentDir ? this.parentDir.depth + 1 : 0;
    }
}

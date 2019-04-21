import { File } from "./File";

export abstract class Reader {
    protected curDir: File = null;
    protected _readerName: string = null;

    abstract convertFile( path: string ): File;
    abstract readdir( dir: File ): Promise<File[]>;
    abstract homeDir(): File;

    get readerName() {
        return this.readerName;
    }

    currentDir(): File {
        return this.curDir;
    }
}

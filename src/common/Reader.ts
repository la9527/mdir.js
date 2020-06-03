import { File } from "./File";

export interface IMountList {
    device: string;
    name: string;
    mountPath: File;
    size: number;
}

export abstract class Reader {
    protected curDir: File = null;
    protected _readerName: string = null;

    abstract convertFile( path: string ): File;
    abstract readdir( dir: File ): Promise<File[]>;
    abstract homeDir(): File;

    abstract rootDir(): File;

    abstract mountList(): Promise<IMountList[]>

    get readerName() {
        return this.readerName;
    }

    currentDir(): File {
        return this.curDir;
    }
}

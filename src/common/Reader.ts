import { File } from "./File";

export interface IMountList {
    device: string;
    name: string;
    mountPath: File;
    size: number;
}

export type ProgressFunc = ( source: File, copySize: number, size: number) => void;

export abstract class Reader {
    protected curDir: File = null;
    protected _readerFsType: string = null;
    public isUserCanceled = false;

    abstract convertFile( path: string ): File;
    abstract readdir( dir: File ): Promise<File[]>;
    abstract homeDir(): File;

    abstract rootDir(): File;

    abstract mountList(): Promise<IMountList[]>

    get readerName() {
        return this._readerFsType;
    }

    currentDir(): File {
        return this.curDir;
    }
    
    abstract sep(): string;
    abstract exist( source: File | string ): boolean;
    abstract copy( source: File, targetDir: File, progress ?: ProgressFunc ): Promise<void>;
    abstract move( source: File, targetDir: File ): Promise<void>;
    abstract remove( source: File ): Promise<void>;
}

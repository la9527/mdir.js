import { File } from "./File";
import { ReadStream, WriteStream } from "fs";

export interface IMountList {
    device: string;
    name: string;
    mountPath: File;
    size: number;
}

export type ProgressFunc = ( source: File, copySize: number, size: number, chunkLength: number) => void;

export abstract class Reader {
    protected curDir: File = null;
    protected _readerFsType: string = null;
    public isUserCanceled = false;

    abstract convertFile( path: string ): File;
    abstract readdir( dir: File, option ?: { isExcludeHiddenFile ?: boolean } ): Promise<File[]>;
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
    abstract mkdir( path: string | File );
    abstract rename( source: File, rename: string ): Promise<void>;
    abstract copy( source: File, target: File, progress ?: ProgressFunc ): Promise<void>;
    abstract remove( source: File ): Promise<void>;
}

import { File } from "./File";
import { ReadStream, WriteStream, FSWatcher } from "fs";

export interface IMountList {
    device: string;
    description: string;
    mountPath: File;
    size: number;
    isCard: boolean;
    isUSB: boolean;
    isRemovable: boolean;
    isSystem: boolean;
}

export enum ProgressResult {
    USER_CANCELED = -1,
    SUCCESS = 0
}

/**
 * @return -1: user cancel, 0 or undefined : continue
 */
export type ProgressFunc = (source: File, copySize: number, size: number, chunkLength: number) => ProgressResult;

export abstract class Reader {
    protected _readerFsType: string = null;
    public isUserCanceled = false;

    abstract convertFile( path: string, option ?: { fileInfo ?: any, useThrow ?: boolean, checkRealPath ?: boolean } ): File;
    abstract readdir( dir: File, option ?: { isExcludeHiddenFile ?: boolean, noChangeDir ?: boolean } ): Promise<File[]>;
    abstract homeDir(): File;

    abstract rootDir(): File;

    abstract mountList(): Promise<IMountList[]>

    get readerName() {
        return this._readerFsType;
    }

    abstract changeDir( dirFile: File );
    abstract currentDir(): File;
    
    abstract sep(): string;
    abstract exist( source: File | string ): boolean;
    abstract mkdir( path: string | File );
    abstract rename( source: File, rename: string ): Promise<void>;
    abstract copy( source: File | File[], target: File, progress ?: ProgressFunc ): Promise<void>;
    abstract remove( source: File ): Promise<void>;
}

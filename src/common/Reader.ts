import { File } from "./File";

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
    protected watchEventFunc: (event?: string, name?: string) => void = null;

    abstract convertFile( path: string, option?: { fileInfo?: any; useThrow?: boolean; checkRealPath?: boolean; virtualFile?: boolean } ): File;
    abstract readdir( dir: File, option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean } ): Promise<File[]>;
    abstract homeDir(): File;

    abstract rootDir(): File;

    abstract mountList(): Promise<IMountList[]>;

    get readerName() {
        return this._readerFsType;
    }

    onWatch( eventFunc: (event?: string, name?: string) => void ) {
        this.watchEventFunc = eventFunc;
    }

    abstract changeDir( dirFile: File );
    abstract currentDir(): File;
    
    abstract sep(): string;
    abstract exist( source: File | string ): boolean;
    abstract mkdir( path: string | File, progress?: ProgressFunc );
    abstract rename( source: File, rename: string, progress?: ProgressFunc ): Promise<void>;
    abstract copy(source: File | File[], sourceBaseDir: File, targetDir: File, progress?: ProgressFunc): Promise<void>;
    abstract remove( source: File | File[], progress?: ProgressFunc ): Promise<void>;
}

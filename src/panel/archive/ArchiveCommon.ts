import * as jschardet from "jschardet";
import * as iconv from "iconv-lite";

import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File } from "../../common/File";
import { Logger } from "../../common/Logger";

const log = Logger("Archive");

export abstract class ArchiveCommon {
    protected originalFile: File = null;
    protected supportType: string = null;

    public setFile( file: File ): boolean {
        if ( !file ) {
            return false;
        }
        this.originalFile = file;
        this.supportType = this.isSupportType( file );
        return !!this.supportType;
    }

    public getSupportType(): string {
        return this.supportType;
    }

    protected abstract isSupportType( file: File ): string;
    public abstract getArchivedFiles(progress?: ProgressFunc): Promise<File[]>;

    abstract compress( files: File[], progress?: ProgressFunc ): Promise<boolean>;
    abstract uncompress( extractDir: File, files ?: File[], progress?: ProgressFunc ): Promise<boolean>;

    protected decodeString(buffer) {
        let result = null;
        try {
            result = jschardet.detect( buffer );
        } catch ( e ) {
            log.error( e );
        }
        let data = null;
        if ( result && result.encoding && [ "utf8", "ascii" ].indexOf(result.encoding) === -1 ) {
            if ( (global as any)?.LOCALE?.indexOf("ko_KR") > -1 ) {
                if ( result.confidence < 0.7 || result.encoding === "windows-1252") {
                    result.encoding = "EUC-KR";
                }
            }
            data = iconv.decode(buffer, result.encoding);
        } else {
            data = buffer.toString("utf8");
        }
        //log.info( "decode file: %s %s", result, data );
        return data;
    }
}





import { ArchiveReader } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { File } from "../common/File";
import { ProgressResult } from "../common/Reader";
import selection, { ClipBoard } from "../panel/Selection";

// let archiveReader = new ArchiveReader();

let file = FileReader.convertFile("C:\\Users\\la952\\Documents\\D2Coding-Ver1.3.2-20180524.zip");
//let file = FileReader.convertFile("./hoppinmoweb.zip");
console.log( file );

(async () => {
    let reader = new ArchiveReader();
    if ( await reader.setArchiveFile( file, null ) ) {
        const files = await reader.readdir( reader.rootDir() );

        let select = selection();
        select.set( files, reader.rootDir(), ClipBoard.CLIP_COPY, reader );
        
        await select.expandDir();

        let selectFiles = select.getFiles();

        let progressFunc = (source: File, copySize: number, size: number, chunkLength: number): ProgressResult => {
            console.log( source.name, copySize, size, chunkLength );
            return ProgressResult.SUCCESS;
        };
        
        try {
            await reader.copy( selectFiles, FileReader.convertFile("./test_dir"), progressFunc);
        } catch( e ) {
            console.error( "Exception:", e );
        }
    }
})();

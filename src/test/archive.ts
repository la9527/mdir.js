import { ArchiveReader } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { File } from "../common/File";
import { ProgressResult } from "../common/Reader";
import selection, { ClipBoard } from "../panel/Selection";

(async () => {
    let file = FileReader.convertFile("test.zip");
    //let file = FileReader.convertFile("./test.tar.gz");

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

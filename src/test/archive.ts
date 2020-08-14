(global as any).DEBUG_STDOUT = true;

import { ArchiveReader } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { File } from "../common/File";
import { ProgressResult } from "../common/Reader";
import selection, { ClipBoard } from "../panel/Selection";

(async () => {
    //let file = FileReader.convertFile("mdir.js-0.8.1-alpha.tgz");
    //let file = FileReader.convertFile("./test.tar.gz");
    let file = FileReader.convertFile("./src.zip");

    let reader = new ArchiveReader();
    if ( await reader.setArchiveFile( file, null ) ) {
        let fileReader = new FileReader();
        const files = await fileReader.readdir( FileReader.convertFile(".") );
        
        let select = selection();
        select.set( files.filter((item) => item.name.match("images") ), fileReader.currentDir(), ClipBoard.CLIP_COPY, fileReader );
        
        await select.expandDir();

        let selectFiles = select.getFiles();

        let progressFunc = (source: File, copySize: number, size: number, chunkLength: number): ProgressResult => {
            console.log( source.name, copySize, size, chunkLength );
            return ProgressResult.SUCCESS;
        };
        
        try {
            await reader.copy( selectFiles, select.getSelecteBaseDir(), reader.currentDir(), progressFunc);

            console.log( "FINISH !!!" );
        } catch( e ) {
            console.error( "Exception:", e );
        }
    }
})();

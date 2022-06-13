(global as any).DEBUG_INFO = { stdout: true };

import { ArchiveReader } from "../panel/archive/ArchiveReader.mjs";
import { FileReader } from "../panel/FileReader.mjs";
import { File } from "../common/File.mjs";
import { ProgressResult } from "../common/Reader.mjs";
import selection, { ClipBoard } from "../panel/Selection.mjs";

(async () => {
    //let file = await FileReader.convertFile("mdir.js-0.8.1-alpha.tgz");
    //let file = await FileReader.convertFile("./test.tar.gz");
    const file = await FileReader.convertFile("./src.zip");

    const reader = new ArchiveReader();
    if ( await reader.setArchiveFile( file, null ) ) {
        const fileReader = new FileReader();
        const files = await fileReader.readdir( await FileReader.convertFile(".") );
        
        const select = selection();
        select.set( files.filter((item) => item.name.match("images") ), await fileReader.currentDir(), ClipBoard.CLIP_COPY, fileReader );
        
        await select.expandDir();

        const selectFiles = select.getFiles();

        const progressFunc = (source: File, copySize: number, size: number, chunkLength: number): ProgressResult => {
            console.log( source.name, copySize, size, chunkLength );
            return ProgressResult.SUCCESS;
        };
        
        try {
            await reader.copy( selectFiles, select.getSelecteBaseDir(), await reader.currentDir(), progressFunc);

            console.log( "FINISH !!!" );
        } catch( e ) {
            console.error( "Exception:", e );
        }
    }
})();

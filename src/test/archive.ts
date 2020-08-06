import { ArchiveReader, ArchiveTarZip } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { log } from "winston";

// let archiveReader = new ArchiveReader();

let file = FileReader.convertFile("./impay.tar.gz");
//let file = FileReader.convertFile("./hoppinmoweb.zip");

(async () => {
    /*
    let archiveTarZip = new ArchiveTarZip();
    if ( archiveTarZip.setFile( file ) ) {
        console.log( "ARCHIVE FILES !!!");
        await archiveTarZip.archivedFiles();
    }
    */
    let reader = new ArchiveReader();
    if ( await reader.setArchiveFile( file, null ) ) {
        const files = await reader.readdir( reader.rootDir() );
        files.map( item => {
            console.log( item.fullname );
        });
    }
})();

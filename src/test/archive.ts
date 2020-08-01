import { ArchiveReader, ArchiveTarZip } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { log } from "winston";

// let archiveReader = new ArchiveReader();

//let file = FileReader.convertFile("./impay.tar.gz");
let file = FileReader.convertFile("./src.zip");

(async () => {
    let archiveTarZip = new ArchiveTarZip();
    if ( archiveTarZip.setFile( file ) ) {
        console.log( "ARCHIVE FILES !!!");
        await archiveTarZip.archivedFiles();
    }
})();

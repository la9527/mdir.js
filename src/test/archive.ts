import { ArchiveReader } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { log } from "winston";

// let archiveReader = new ArchiveReader();

let file = FileReader.convertFile("./황금백수.zip");
//let file = FileReader.convertFile("./hoppinmoweb.zip");

(async () => {
    let reader = new ArchiveReader();
    if ( await reader.setArchiveFile( file, null ) ) {
        const files = await reader.readdir( reader.rootDir() );
        files.map( item => {
            console.log( item.fullname );
        });
    }
})();

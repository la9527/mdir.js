(global as any).DEBUG_STDOUT = true;

/* eslint-disable @typescript-eslint/no-unused-vars */
import "jest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "../../../common/Logger";
import { FileReader } from "../../FileReader";
import { SftpReader } from "../SftpReader";

const log = Logger("SFTP TEST");

describe( "SFTP Test", () => {
    const getSftpReaderConnection = async () => {
        const sftpReader = new SftpReader();
        await sftpReader.connect({
            host: "localhost",
            port: 22,
            username: "la9527",
            password: "??",
            // debug: console.log
        });
        return sftpReader;
    };

    it("SFTP TEST", async () => {
        try {
            const sftpReader = await getSftpReaderConnection();
            log.debug( "connect end !!!" );
            const homeDir = await sftpReader.homeDir();
            const result = await sftpReader.readdir(homeDir);

            const readmeFile = await FileReader.convertFile( "./README.md", { checkRealPath: true } );

            const targetBasePath = homeDir.fullname;
            const target = readmeFile.clone();
            target.fullname = targetBasePath + "/" + target.name;
            target.fstype = sftpReader.readerName;
            target.root = "/";

            await sftpReader.mkdir( homeDir.fullname + "/test2" );

            expect(await sftpReader.exist( homeDir.fullname + "/test2" )).toBeTruthy();
            const convertFile = await sftpReader.convertFile(homeDir.fullname + "/test2");
            if ( convertFile ) {
                log.debug( convertFile.fullname );
                await sftpReader.remove( convertFile );
            }

            await sftpReader.copy( readmeFile, null, target );

            expect(await sftpReader.exist( target.fullname )).toBeTruthy();
            const targetFile = await sftpReader.convertFile(target.fullname);
            log.debug( JSON.stringify(targetFile) );

            const renameFile = targetFile.clone();
            renameFile.fullname = target.fullname + ".bak";
            await sftpReader.rename( target, renameFile.fullname );

            expect(await sftpReader.exist( renameFile.fullname )).toBeTruthy();
            await sftpReader.remove( renameFile );
        } catch( e ) {
            console.error( e );
            return;
        }
    });
});

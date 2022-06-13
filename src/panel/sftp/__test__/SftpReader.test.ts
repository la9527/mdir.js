(global as any).DEBUG_INFO = { stdout: true };

/* eslint-disable @typescript-eslint/no-unused-vars */
import "jest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "../../../common/Logger.mjs";

const log = Logger("SFTP TEST");

describe( "SFTP Proxy Test", () => {
    const getSftpReaderConnection = async () => {
        const SftpReader = (await import("../SftpReader.mjs")).SftpReader;

        const sftpReader = new SftpReader();
        log.debug( "CONNECT !!!");

        await sftpReader.sessionConnect({
            host: "localhost",
            port: 22,
            username: "la9527",
            password: "???",
            algorithms: {
                kex: [ "diffie-hellman-group1-sha1","diffie-hellman-group14-sha1", "ecdh-sha2-nistp256","ecdh-sha2-nistp384","ecdh-sha2-nistp521","diffie-hellman-group-exchange-sha256","diffie-hellman-group14-sha256","diffie-hellman-group16-sha512","diffie-hellman-group18-sha512","diffie-hellman-group14-sha1" ],
                serverHostKey: [ "ssh-ed25519","ecdsa-sha2-nistp256","ecdsa-sha2-nistp384","ecdsa-sha2-nistp521","ssh-rsa" ],
                cipher: [ "aes128-ctr","aes192-ctr","aes256-ctr","aes128-gcm","aes128-gcm@openssh.com","aes256-gcm","aes256-gcm@openssh.com", "3des-cbc", "blowfish-cbc" ],
                hmac: [ "hmac-sha2-256", "hmac-sha2-512", "hmac-sha1", "hmac-md5" ],
                compress: [ "none", "zlib@openssh.com", "zlib" ]
            }
            // debug: console.log
        }, (err) => {
            log.error( err );
        });
        return sftpReader;
    };

    it("SFTP TEST", async () => {
        try {
            const sftpReader = await getSftpReaderConnection();
            log.debug( "connect end !!!" );
            const homeDir = await sftpReader.homeDir();
            const result = await sftpReader.readdir(homeDir);
            log.debug( result );

            /*
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
            */
        } catch( e ) {
            console.error( e );
            return;
        }
    });
});

/*
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
*/

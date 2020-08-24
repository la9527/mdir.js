/* eslint-disable @typescript-eslint/no-unused-vars */
import "jest";
import Configure from "../Configure";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileReader } from "../../panel/FileReader";
import { ConfigureDefault } from "../ConfigureDefault";

afterAll(() => {
    fs.unlinkSync( os.homedir() + path.sep + ".m" + path.sep + "configure.json" );
    console.log( "file remove !!!" );
});

describe( "Configure", () => {
    it("Configure.instance", () => {
        const configure = Configure.instance();
        expect( fs.existsSync(configure.getConfigPath()) ).toBe(true);
    });

    it.each([
        [ "./package.json", "editor" ],
        [ "./fixture.jpg", "supportImage" ]
    ])("Configure.instance create - %s", (textFileName, aliasName) => {
        const file = FileReader.convertFile(textFileName, { checkRealPath: true } );
        const configure = Configure.instance();

        expect( configure.getMimeTypeAlias( file ) ).toBe(aliasName);
        const result = configure.getMatchProgramInfo( file );
        expect( result ).toBeDefined();
    });

    it("Configure option test", () => {
        (global as any).configure = null;
        let configure = Configure.instance();
        configure.setOption( "TestBoolean", true );
        configure.setOption( "TestStr", "TEST" );
        configure.setOption( "TestNumber", 1234 );
        configure.save();

        (global as any).configure = null;
        configure = Configure.instance();
        expect( configure.getOption( "TestBoolean" ) ).toBeTruthy();
        expect( configure.getOption( "TestStr" ) ).toBe("TEST");
        expect( configure.getOption( "TestNumber" ) ).toBe(1234);
    });
});
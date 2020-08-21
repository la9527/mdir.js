import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { File } from "../common/File";
import { ConfigureDefault } from "./ConfigureDefault";
import { Logger } from "../common/Logger";

const log = Logger("Configure");

export interface IMimeTypeAlias {
    name: {
        [aliasName: string]: string | string[]
    },
    ext: {
        [aliasName: string]: string | string[]
    }
}

export interface IProgramServiceInfo {
    name: string;
    command?: string | { win32: string; darwin: string; linux: string; };
    method?: string;
    methodParam?: string[];
    mterm?: boolean;
}

export interface IProgramService {
    [programAliasName: string]: IProgramServiceInfo;
}

export interface IProgramMatching {
    [aliasName: string]: string | string[];
}

export interface IConfigure {
    Version: string;
    MimeTypeAlias: IMimeTypeAlias;
    ProgramService: IProgramService;
    ProgramMatching: IProgramMatching;
    Option: {
        [name: string]: string | boolean | number;
    }
}

export interface IProgramInfo {
    orgCmdText: string;
    name?: string;
    command?: string;
    method?: string;
    methodParam?: string[];
    mterm?: boolean;
}

export default class Configure {
    private configInfo: IConfigure = ConfigureDefault;

    constructor() {
        this.load();
    }

    public getConfigPath() {
        return os.homedir() + path.sep + ".m" + path.sep + "configure.json";
    }

    public load() {
        try {
            if ( fs.existsSync(this.getConfigPath()) ) {
                const text = fs.readFileSync( this.getConfigPath(), { encoding: "utf8" } );
                const configInfo = JSON.parse( text );
                if ( configInfo.Version !== this.configInfo.Version ) {
                    process.stdout.write( `Invalid version - file ${this.getConfigPath()}. Load initial settings.` );
                } else {
                    this.configInfo = configInfo;
                }
            } else {
                this.save();
            }
        } catch( e ) {
            log.error( e );
            throw e;
        }
    }

    public save() {
        try {
            fs.writeFileSync( this.getConfigPath(), JSON.stringify( this.configInfo, null, 2), { encoding: "utf8" } );
        } catch( e ) {
            log.error( e );
        }
    }

    public getMimeTypeAlias( file: File ): string {
        let mimeTypeAlias = this.configInfo.MimeTypeAlias;
        let filename = path.parse(file.name).name;
        let fileext = file.extname;

        let convertStrSplitArray = (item: string | string[]): string[] => {
            if ( !item ) {
                return [];
            }
            let text = Array.isArray(item) ? item.join("") : item;
            return text ? (text as string).split(";").filter(item => !!item) : [];
        };

        let result = Object.keys(mimeTypeAlias.name)
                        .find( aliasName => convertStrSplitArray(mimeTypeAlias.name[aliasName]).indexOf(filename) > -1);
        if ( result ) {
            return result;
        }
        result = Object.keys(mimeTypeAlias.ext)
            .find( aliasName => convertStrSplitArray(mimeTypeAlias.ext[aliasName]).indexOf(fileext.replace(/^./, "")) > -1 );
        return result;
    }

    protected convertCmdProgramInfo( cmdText: string, file: File ): IProgramInfo {
        let item : IProgramInfo = null;
        let matchInfo = cmdText.match( /<(\w+)>/ );
        if ( matchInfo.length !== 2 ) {
            return {
                orgCmdText: cmdText
            };
        }

        let result = this.configInfo.ProgramService[ matchInfo[1] ];
        if ( !result ) {
            throw new Error("parsing fail: " + cmdText );
        }

        const { name, command, method, methodParam, mterm } = result;
        let cmd = null;
        if ( command ) {
            cmd = command[ os.platform() ] || command;
            cmd = cmdText.replace( /<(\w+)>/, cmd );
        }
        return {
            orgCmdText: cmdText,
            command: cmd,
            name, 
            method, 
            methodParam, 
            mterm
        };
    }

    public getMatchProgramInfo( file: File ): IProgramInfo[] {
        let aliasName = this.getMimeTypeAlias( file );
        if ( !aliasName ) {
            aliasName = "etc";
        }

        let programMatching: string | string[] = this.configInfo.ProgramMatching[aliasName];
        if ( !programMatching ) {
            throw new Error(`parsing fail - Undefine ProgramMatching key [${aliasName}]`  );
        }
        
        programMatching = Array.isArray(programMatching) ? programMatching : [ programMatching ];
        return programMatching.map( item => {
            return this.convertCmdProgramInfo( item, file );
        });
    }

    public getOption( key: string ): string | boolean | number {
        return this.configInfo.Option[ key ];
    }

    public setOption( key: string, value: string | boolean | number ) {
        this.configInfo.Option[key] = value;
    }

    static instance(): Configure {
        if ( !(global as any).configure ) {
            (global as any).configure = new Configure();
        }
        return (global as any).configure;
    }
}

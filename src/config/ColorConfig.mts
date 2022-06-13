import path from "path";
import os from "os";
import fs from "fs";

import Configure from "./Configure.mjs";
import { ColorDefault } from "./ColorDefault.mjs";
import { Color } from "../common/Color.mjs";
import { File } from "../common/File.mjs";
import { Logger } from "../common/Logger.mjs";
import colors from "colors";

const log = Logger("ColorConfig");

export class ColorConfig {
    static instance(): ColorConfig {
        if ( !(global as any).ColorConfig ) {
            (global as any).ColorConfig = new ColorConfig();
        }
        return (global as any).ColorConfig;
    }

    private fileExt = {};
    private _colorConfig: any = { base: {}, file: { name: {}, ext: {} } };

    constructor() {
        this.load();
    }

    public getConfigPath() {
        return os.homedir() + path.sep + ".m" + path.sep + "configure_color.json";
    }

    public load() {
        try {
            if ( fs.existsSync(this.getConfigPath()) ) {
                const result = fs.readFileSync( this.getConfigPath(), { encoding: "utf8" } );
                const colorConfigInfo = JSON.parse( result );
                if ( colorConfigInfo.version !== ColorDefault.version ) {
                    process.stdout.write( colors.bold("Warning: ") + colors.red(`Invalid version - file ${this.getConfigPath()}. restore to initial file after backup.`) + "\n" );
                    fs.renameSync( this.getConfigPath(), this.getConfigPath() + ".bak" );
                    fs.writeFileSync( this.getConfigPath(), JSON.stringify( ColorDefault, null, 2), { encoding: "utf8" } );
                    this.parsingColorConfig();
                } else {
                    this.parsingColorConfig( colorConfigInfo );
                }
            } else {
                fs.writeFileSync( this.getConfigPath(), JSON.stringify( ColorDefault, null, 2), { encoding: "utf8" } );
                this.parsingColorConfig();
            }
        } catch( e ) {
            log.error( e );
            throw e;
        }
    }

    parsingColorConfig( config: any = ColorDefault): void {
        const supportTransparent = Configure.instance().getOption("supportBgColorTransparent") || false;
        const colorDefault = config.base.default.split(",");

        Object.keys(config.base).map( (name) => {
            const item = config.base[name].split(",");
            if ( item.length === 1 ) {
                item.push( colorDefault[1] );
            }
            if ( !supportTransparent && Number(item[1]) === -1 ) {
                this._colorConfig.base[name] = [ Number(item[0]), 0 ];
            } else {
                this._colorConfig.base[name] = [ Number(item[0]), Number(item[1]) ];
            }
        });

        const nameColor = {};
        Object.keys(config.file.name).map( (bgColor) => {
            const item = config.file.name[bgColor];
            (Array.isArray(item) ? item.join("") : item).split(";").map( (name) => {
                if ( !supportTransparent && Number(colorDefault[1]) === -1 ) {
                    nameColor[name] = [ Number(bgColor), 0 ];
                } else {
                    nameColor[name] = [ Number(bgColor), Number(colorDefault[1]) ] 
                }
            });
        });

        this._colorConfig.file.name = nameColor;

        const extColor = {};
        Object.keys(config.file.ext).map( (bgColor) => {
            const item = config.file.ext[bgColor];
            (Array.isArray(item) ? item.join("") : item).split(";").map( (ext) => {
                if ( !supportTransparent && Number(colorDefault[1]) === -1 ) {
                    extColor[ext.toLowerCase()] = [ Number(bgColor), 0 ] 
                } else {
                    extColor[ext.toLowerCase()] = [ Number(bgColor), Number(colorDefault[1]) ] 
                }
                
            });
        });

        this._colorConfig.file.ext = extColor;
    }

    getBaseColor( name: string ): Color {
        return new Color(this._colorConfig.base[name]);
    }

    getBaseTwoColor( fgname: string, bgname: string ): Color {
        return new Color(this._colorConfig.base[fgname][0], this._colorConfig.base[bgname][1]);
    }

    getFileColor( file: File ): Color {
        const extname = file.extname.substr(1).toLowerCase(); // .ext => ext
        let color = this._colorConfig.base.default;
        if ( file.dir ) {
            color = this._colorConfig.base.dir;
        } else {
            color = this._colorConfig.file.ext[extname] || this._colorConfig.file.name[file.name] || color;
            if ( !color || (color[0] === 0 && color[1] === 0) ) {
                color = this._colorConfig.base.default;
            }
        }
        return new Color( color );
    }
}

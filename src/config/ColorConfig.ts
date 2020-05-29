import { ColorDefault } from "./ColorDefault";
import { Color } from "../common/Color";
import { File } from "../common/File";
import { Logger } from "../common/Logger";

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
        this.parsingColorConfig();
    }

    parsingColorConfig( config: any = ColorDefault): void {
        const colorDefault = config.base.default.split(",");

        Object.keys(config.base).map( (name) => {
            const item = config.base[name].split(",");
            if ( item.length === 1 ) {
                item.push( colorDefault[1] );
            }
            this._colorConfig.base[name] = [ Number(item[0]), Number(item[1]) ];
        });

        const nameColor = {};
        Object.keys(config.file.name).map( (bgColor) => {
            const item = config.file.name[bgColor];
            (Array.isArray(item) ? item.join("") : item).split(";").map( (name) => nameColor[name] = [ Number(bgColor), Number(colorDefault[1]) ] );
        });

        this._colorConfig.file.name = nameColor;

        const extColor = {};
        Object.keys(config.file.ext).map( (bgColor) => {
            const item = config.file.ext[bgColor];
            (Array.isArray(item) ? item.join("") : item).split(";").map( (ext) => extColor[ext] = [ Number(bgColor), Number(colorDefault[1]) ] );
        });

        this._colorConfig.file.ext = extColor;
        log.debug( extColor );
    }

    getBaseColor( name: string ): Color {
        return new Color(this._colorConfig.base[name]);
    }

    getFileColor( file: File ): Color {
        const extname = file.extname;
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

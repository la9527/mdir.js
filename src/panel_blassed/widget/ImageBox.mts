/* eslint-disable prefer-const */
import { Widget } from "./Widget.mjs";
import { Widgets } from "../../../@types/blessed";
import { File } from "../../common/File.mjs";
import { Logger } from "../../common/Logger.mjs";
import fs from "fs";
import Jimp from "jimp";
import chalk from "chalk";
import colors from "neo-blessed/lib/colors.js";
import { ColorConfig } from "../../config/ColorConfig.mjs";
import mainFrame from "../MainFrame.mjs";
import { createSupportsColor } from "supports-color";

const log = Logger("InputBox");
const PIXEL = "\u2584";

const supportColorLevel: any = createSupportsColor(process.stdout);

export class ImageWidget extends Widget {
    imageBuffer: Jimp = null;
    originalSize = { width: 0, height: 0 };

    constructor( options: any ) {
        super( { ...options, scrollable: false } );
        
        (this.box as any).render = () => {
            this._render();
        };
    }

    pixelToCell(pixel, pixel2?: any, ch?: any ) {
        let bga = 1.0
            , fga = 0.5
            , a = pixel.a / 255
            , bg
            , fg;
      
        bg = colors.match(pixel.r * bga | 0, pixel.g * bga | 0, pixel.b * bga | 0);

        if (ch && pixel2) {
            fg = colors.match( pixel2.r * fga | 0, pixel2.g * fga | 0, pixel2.b * fga | 0);
        } else {
            fg = 0x1ff;
            ch = null;
        }
        // if (a === 0) bg = 0x1ff;      
        return [(0 << 18) | (fg << 9) | (bg << 0), ch || " ", a];
    }

    async setImage( imagefile: File | string ) {
        const buffer = await fs.promises.readFile( imagefile instanceof File ? imagefile.fullname : imagefile );
        this.imageBuffer = await Jimp.read(buffer);
        this.originalSize = { width: this.imageBuffer.getWidth(), height: this.imageBuffer.getHeight() };
    }

    getImageText() {
        let result = "";
        for (let y = 0; y < this.imageBuffer.bitmap.height - 1; y += 2) {
            for (let x = 0; x < this.imageBuffer.bitmap.width; x++) {
                const {r, g, b, a} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x, y));
                const {r: r2, g: g2, b: b2} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x, y + 1));    
                if (a === 0) {
                    result += chalk.reset(" ");
                } else {
                    result += chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(PIXEL);
                }
            }
            result += "\n";
        }
        return result;
    }

    scale(width, height, originalWidth, originalHeight) {
        log.debug( "scale [%s,%s,%s,%s]", width, height, originalWidth, originalHeight );
        const originalRatio = originalWidth / originalHeight;
        const factor = (width / height > originalRatio ? height / originalHeight : width / originalWidth);
        width = factor * originalWidth;
        height = factor * originalHeight;
        return {width, height};
    }

    draw() {
        // const { width, height } = this.scale(this.width, this.height, this.originalSize.width, this.originalSize.height);
        // log.debug( "image size [%s, %s]", width, height)
        this.imageBuffer.resize( this.width as number, supportColorLevel.level > 2 ? (this.height as number) * 2 : (this.height as number) );
    }

    _render(startRow = -1, endRow = -1) {
        const box = this.box as any;
        const screen = this.screen as any;

        let ret = null;
        try {
            ret = box._render();
        } catch( e ) {
            log.error( e );
            return;
        }

        if (!ret) return;

        box.dattr = box.sattr(box.style);
        
        let xi = ret.xi + box.ileft
            , xl = ret.xl - box.iright
            , yi = ret.yi + box.itop
            , yl = ret.yl - box.ibottom;

        for (let y = Math.max(yi, 0); y < yl; y++) {
            let line = screen.lines[y];            
            if (!line) break;
            for (let x = Math.max(xi, 0); x < xl; x++) {
                if (!line[x]) break;

                if ( supportColorLevel.level > 2 ) { // true color support
                    let iy = (y - yi) * 2;
                    if ( x - xi < this.imageBuffer.getWidth() && iy < this.imageBuffer.getHeight() ) {
                        const {r, g, b, a} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x - xi, iy));
                        const {r: r2, g: g2, b: b2} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x - xi, iy + 1));
                        const cell = this.pixelToCell( { r, g, b, a }, {r: r2, g: g2, b: b2} );
                        line[x][0] = cell[0];
                        line[x][1] = "\u2584";
                        line[x][2] = { bg: {r, g, b, a}, fg: {r: r2, g: g2, b: b2} };
                    }
                } else {
                    let iy = (y - yi);
                    if ( x - xi < this.imageBuffer.getWidth() && iy < this.imageBuffer.getHeight() ) {
                        const {r, g, b, a} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x - xi, iy));
                        const cell = this.pixelToCell( { r, g, b, a } );
                        line[x][0] = cell[0];
                        line[x][1] = " ";
                    }
                }
            }
            line.dirty = true;
            screen.lines[y] = line;
        }

        if ( startRow !== -1 && endRow !== -1 ) {
            screen.draw(yi + startRow, yi + endRow);
        }
        return ret;
    }
}

interface IImageBoxOptions {
    file: File;
    closeFunc: () => void;
}

export class ImageViewBox extends Widget {
    private imageWidget: ImageWidget = null;
    private titleWidget: Widget = null;
    private color = null;
    private option: IImageBoxOptions = null;

    constructor( opts: Widgets.BoxOptions | any ) {
        super( { parent: opts.parent, ...opts, top: "center", left: "center", width: "50%", height: "80%", border: "line", clickable: true });

        this.box.enableMouse();
        this.init();
    }

    async setImageOption( option: IImageBoxOptions ) {
        this.option = option;
        await this.imageWidget.setImage( option.file );
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    resize() {
        
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");

        log.debug( "this.color : %s", this.color);

        this.box.style = { ...this.color.blessed, border: this.color.blessed };
        this.titleWidget = new Widget( { 
            parent: this, 
            top: 0, 
            width: "100%-2", 
            height: 1, 
            tags: true, 
            content: "", 
            style: this.color.blessedReverse, 
            align: "center" } );

        this.imageWidget = new ImageWidget( {
            parent: this.box, 
            top: 1, 
            left: "center",
            width: "100%-2", 
            style: this.color.blessed, 
            height: "100%-3", 
            align: "center"
        });

        this.resize();

        this.box.off("keypress");
        this.box.on("element click", () => {
            this.destroy();
            this.option && this.option.closeFunc();
        });
        this.box.on("keypress", async (ch, keyInfo) => {
            log.info( "KEYPRESS [%s]", keyInfo.name );
            if ( "enter" === keyInfo.name ) {
                return;
            }

            if ( [ "return", "space", "escape" ].indexOf(keyInfo.name) > -1 ) {
                this.destroy();
                this.option && this.option.closeFunc();
                return;
            }
            this.render();
            this.box.screen.render();
        });

        mainFrame().lockKey("imageBox", this);
        this.on("detach", () => {
            mainFrame().lockKeyRelease("imageBox");
        });
        this.setFocus();
        this.box.screen.render();
    }

    draw() {
        this.resize();

        if ( this.option && this.option.file ) {
            this.option.file.name && this.titleWidget.setContent( this.option.file.name );
        }
    }

    destroy() {
        this.imageWidget.destroy();
        this.titleWidget.destroy();
        super.destroy();
    }
}

import { Widget } from "./Widget";
import { Widgets, text, input, button, form } from "neo-blessed";
import { File } from "../../common/File";
import { Logger } from '../../common/Logger';
import fs from "fs";
import Jimp from "jimp";
import chalk from "chalk";
import * as colors from "neo-blessed/lib/colors";

const log = Logger("InputBox");
const PIXEL = '\u2584';

export class ImageBox extends Widget {
    imageBuffer: Jimp = null;
    originalSize = { width: 0, height: 0 };

    constructor( options: any ) {
        super( { ...options, scrollable: false } );
        
        (this.box as any).render = () => {
            this._render();
        };
    }

    
    getOutch( pixel ) {
        const dchars = '????8@8@#8@8##8#MKXWwz$&%x><\\/xo;+=|^-:i\'.`,  `.        ';
        let luminance = (pixel) => {
            let a = pixel.a / 255
              , r = pixel.r * a
              , g = pixel.g * a
              , b = pixel.b * a
              , l = 0.2126 * r + 0.7152 * g + 0.0722 * b;        
            return l / 255;
        };
        let lumi = luminance(pixel);
        let outch = dchars[lumi * (dchars.length - 1) | 0];
        return outch;
    }
    
    pixelToCell(pixel, pixel2, ch ?: any ) {
        let bga = 1.0
          , fga = 0.5
          , a = pixel.a / 255
          , bg
          , fg;
      
        bg = colors.match(pixel.r * bga | 0, pixel.g * bga | 0, pixel.b * bga | 0);
      
        if (ch) {
            fg = colors.match( pixel2.r * fga | 0, pixel2.g * fga | 0, pixel2.b * fga | 0);
        } else {
            fg = 0x1ff;
            ch = null;
        }
        // if (a === 0) bg = 0x1ff;      
        return [(0 << 18) | (fg << 9) | (bg << 0), ch || ' ', a];
    }

    async setImage( imagefile: File | string ) {
        const buffer = await fs.promises.readFile( imagefile instanceof File ? imagefile.fullname : imagefile );
        this.imageBuffer = await Jimp.read(buffer);
        this.originalSize = { width: this.imageBuffer.getWidth(), height: this.imageBuffer.getHeight() };
    }

    getImageText() {
        let result = '';
        for (let y = 0; y < this.imageBuffer.bitmap.height - 1; y += 2) {
            for (let x = 0; x < this.imageBuffer.bitmap.width; x++) {
                const {r, g, b, a} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x, y));
                const {r: r2, g: g2, b: b2} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x, y + 1));    
                if (a === 0) {
                    result += chalk.reset(' ');
                } else {
                    result += chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(PIXEL);
                }
            }
            result += '\n';
        }
        return result;
    }

    scale(width, height, originalWidth, originalHeight) {
        const originalRatio = originalWidth / originalHeight;
        const factor = (width / height > originalRatio ? height / originalHeight : width / originalWidth);
        width = factor * originalWidth;
        height = factor * originalHeight;
        return {width, height};
    }

    draw() {
        const { width, height } = this.scale(this.width, this.height, this.originalSize.width, this.originalSize.height);
        log.debug( "image size [%d, %d]", width, height)
        this.imageBuffer.resize( width, height );
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
                if ( x - xi < this.imageBuffer.getWidth() && y - yi < this.imageBuffer.getHeight() ) {
                    const {r, g, b, a} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x - xi, y - yi));
                    const {r: r2, g: g2, b: b2} = Jimp.intToRGBA(this.imageBuffer.getPixelColor(x - xi, (y - yi) + 1));
                    const cell = this.pixelToCell( { r, g, b, a }, { r2, g2, b2, a } ); // this.getOutch( pixel )
                    line[x][0] = cell[0];
                    line[x][1] = '\u2584'; // cell[1];
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

import { File } from "../common/File";
import { Reader } from "../common/Reader";

class Dir {
    public file: File = null;
    public depth: number = -1;
    public row: number = -1;
    public index: number = -1;

    public parentDir: Dir = null;
    public isCheck: boolean = false;

    public subDir: Dir[] = [];

    constructor( file: File, parentDir: Dir, isCheck: boolean = false ) {
        this.file = file;
        this.parentDir = parentDir;
        this.isCheck = isCheck;
        this.depth = this.parentDir ? this.parentDir.depth + 1 : 0;
    }
}

class Mcd {
    protected isSort: boolean = false;
    protected isHidden: boolean = false;

    protected arrayDirContainer: Dir[] = [];

    protected scrollRow: number = 0;
    protected scrollCol: number = 0;

    protected reader: Reader = null;
    protected rootDir: Dir = null;

    protected currentDir: number = -1;

    constructor( path: string ) {
        
    }

    setCurrentDir(path: string = "") {
        if ( !path ) {
            this.currentDir = 0;
            return;
        }


    }

    getDirRowArea( findRow: number, depth: number ): Dir {
        let tempNodeOver = [];
        let tempNodeUnder = [];
        
        this.arrayDirContainer.map( (item) => {
            if ( item.depth === depth ) {
                if ( item.row <= findRow ) {
                    tempNodeOver.push( item );
                } else if ( item.row > findRow ) {
                    tempNodeUnder.push( item );
                }
            }
        });

        let overDir: Dir = tempNodeOver.length > 0 ? tempNodeOver[0] : null;
        let underDir: Dir = tempNodeUnder.length > 0 ? tempNodeUnder[tempNodeUnder.length - 1] : null;
        if ( overDir && underDir ) {
            if ( overDir.row - findRow < findRow - underDir.row ) {
                return underDir;
            } else {
                return overDir;
            }
        } else if ( overDir ) {
            return overDir;
        } else if ( underDir ) {
            return underDir;
        }
        return null;
    }

    rescan( depth: number = 0) {

    }

    scan( dir: Dir, depth = 0 ) {

    }


}
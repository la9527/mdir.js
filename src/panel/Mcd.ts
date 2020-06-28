import * as fs from "fs";
import * as path from "path";

import { SortType } from "../common/Sort";
import { Dir } from "../common/Dir";
import { Reader } from '../common/Reader';
import { File } from "../common/File";
import { readerControl } from "./readerControl";
import { Logger } from "../common/Logger";
import { Help, IHelpService } from "../config/KeyMapConfig";

const log = Logger("blessed-mcd");

export class Mcd implements IHelpService {
    protected sortType: SortType = SortType.COLOR;

    protected isSort: boolean = false;
    protected isHidden: boolean = false;

    protected arrOrder: Dir[] = [];

    protected scrollRow: number = 0;
    protected scrollCol: number = 0;

    protected reader: Reader = null;
    protected rootDir: Dir = null;

    protected curDirInx: number = -1;

    constructor( reader: Reader = null ) {
        this.setReader( reader );
    }

    viewName() {
        return "Mcd";
    }

    getReader(): Reader {
        return this.reader;
    }
    
    setReader( reader: Reader ) {
        this.reader = reader;
    }

    async scanDir( dir: File ) {
        if ( dir ) {
            await this.addDirectory(dir.fullname);
            this.setCurrentDir(dir.fullname);
        }
    }

    async scanCurrentDir() {
        const dir: File = this.reader.currentDir();
        await this.scanDir( dir );
    }

    async rescan( depth: number = 0): Promise<Boolean> {
        this.arrOrder = [];

        this.rootDir = new Dir(this.reader.rootDir(), null, false);
        const result = await this.scan( this.rootDir, depth );
        return result;
    }

    async scan( dir: Dir, depth = 0 ): Promise<Boolean> {
        let arrDir: Dir[] = [];
        let pTree: Dir = null;
        let depthCount = 1;
        if ( this.rootDir == null ) {
            return false;
        } 

        arrDir.push( dir );

        while( arrDir.length !== 0 ) {
            pTree = arrDir.pop();
            
            let dirInfo: File[] = await this.reader.readdir( pTree.file );
            pTree.subDir = [];
            dirInfo.map( item => {
                if ( item.dir && !item.link ) {
                    if ( pTree.subDir.findIndex( s => s.file.equal(item) ) == -1 ) {
                        pTree.subDir.push( new Dir( item, pTree, false ) );
                    }
                }
            });

            pTree.check = true;
            pTree.subDir = pTree.subDir.sort( (a: Dir, b: Dir) => {
                if ( a.file.name > b.file.name ) return 1;
                if ( b.file.name > a.file.name ) return -1;
                return 0;
            });

            if (depth != depthCount) {
                depthCount++;
                for ( let i = pTree.subDir.length - 1; i >= 0; --i ) {
                    arrDir.push( pTree.subDir[i] );
                }
            }
        }

        this.updateOrder();
        return true;
    }

    hideSubDir( node: Dir ) {
        if ( !node ) return;
        if ( !this.arrOrder.length ) return;

        let j = 0;
        for ( let i = node.index; i < this.arrOrder.length; i++ ) {
            if ( this.arrOrder[i].depth <= node.depth ) break;
            j++;
        }
        this.arrOrder.splice( node.index, j );
        node.subDir = [];
        node.check = false;
        this.updateOrder();
    }

    updateOrder() {
        let dirNode: Dir = null;
        let row = 0;
        let index = 0;
        let orgDepth = -1;

        this.arrOrder = [];
        let temp = [];
        temp.push( this.rootDir );

        while( temp.length != 0 ) {
            dirNode = temp.pop();

            if ( dirNode.depth <= orgDepth ) {
                row++;
            }
            orgDepth = dirNode.depth;

            dirNode.row = row;
            dirNode.index = index++;
            this.arrOrder.push( dirNode );

            for ( let i = dirNode.subDir.length - 1; i >= 0; --i ) {
                temp.push( dirNode.subDir[i] );
            }
        }
    }

    setCurrentDir(path: string = "") {
        if ( !path ) {
            this.curDirInx = 0;
            return;
        }

        if ( path === this.rootDir.file.fullname ) {
            this.curDirInx = 0;
        } else {
            const findDir = this.arrOrder.findIndex( item => {
                return item.file.fullname === path;
            });
            this.curDirInx = findDir > -1 ? findDir : 0;
        }
    }

    getDirRowArea( findRow: number, depth: number, curDir: Dir = null ): Dir {
        let tempNodeOver = [];
        let tempNodeUnder = [];
        
        this.arrOrder.filter(item => item.depth === depth ).map( (item) => {
            if ( item.row <= findRow ) {
                tempNodeUnder.push( item );
            }
            if ( item.row > findRow ) {
                tempNodeOver.push( item ); 
            }
        });

        let overDir: Dir = tempNodeOver.length > 0 ? tempNodeOver[0] : null;
        let underDir: Dir = tempNodeUnder.length > 0 ? tempNodeUnder[tempNodeUnder.length - 1] : null;

        if ( overDir && underDir ) {
            if ( curDir && curDir.row === underDir.row ) {
                return overDir;
            } else if ( curDir && curDir.row === overDir.row ) {
                return underDir;
            }
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

    searchDir( dirPath: string, similar: boolean = true ): Dir {
        if ( !dirPath || this.rootDir == null ) {
            return null;
        }

        const findSubDir = (baseDir: Dir, pathArr) => {
            const lastPathname = pathArr.shift();
            const findDir = baseDir.subDir.find(i => i.file.name === lastPathname);
            if ( !findDir ) {
                return similar ? baseDir : null;
            }
            return findSubDir( findDir, pathArr );
        };

        let pathOnly = dirPath.substr(path.parse(dirPath).root.length);
        let pathArr = pathOnly.split(path.sep);
        return findSubDir( this.rootDir, pathArr );
    }

    async addDirectory( dirPath: string ): Promise<Boolean> {
        if ( this.rootDir == null ) {
            await this.rescan( 1 );
        }
        log.debug( "addDirectory : %s", dirPath );
        let dir: Dir = null;
        let n = 0;
        do {
            dir = this.searchDir( dirPath, true );
            log.debug( "addDirectory: searchDir: [%s]", dir.file.fullname );
            await this.scan( dir, 1 );
        } while( dir.file.fullname !== dirPath && n++ < 10 );
        return true;
    }

    currentDir(num: number = undefined, isChange = false ): Dir {
        let x = this.curDirInx;
        if ( typeof(num) === "number" ) {
            x = this.curDirInx + num;
        }
        if ( x <= -1 || x >= this.arrOrder.length ) {
            x = this.curDirInx;
        }
        if ( isChange ) {
            this.curDirInx = x;
        }
        return this.arrOrder[ x ];
    }

    currentPathFile() {
        return this.currentDir()?.file;
    }

    keyUp() {
        if ( this.currentDir().parentDir ) {
            if ( this.curDirInx - 1 > -1 && this.currentDir().depth !== this.currentDir(-1).depth ) {
                let i = 0;
                for ( i = this.curDirInx - 1; i > 0; --i ) {
                    if ( this.arrOrder[i].depth === this.currentDir().depth ) {
                        break;
                    }
                }
                i === 0 ? this.keyLeft() : this.curDirInx = i;
            } else {
                this.curDirInx--;
            }
        } else {
            this.keyLeft();
        }
    }

    keyLeft() {
        if ( this.currentDir().parentDir ) {
            this.curDirInx = this.currentDir().parentDir.index;
        }
    }

    async keyRightPromise() {
        if ( this.currentDir().subDir.length ) {
            this.curDirInx = this.currentDir().subDir[0].index;
        } else {
            const fullname = this.currentDir().file.fullname;
            await this.scan( this.currentDir(), 1 );
            this.setCurrentDir(fullname);
            if ( !this.currentDir().subDir.length ) {
                this.currentDir(1, true);
            } else {
                if ( this.currentDir().subDir.length && this.currentDir().depth - this.scrollCol == 5 ) {
                    this.scrollCol++;
                }
            }
        }
    }

    async keyDownPromise() {
        if ( this.currentDir().parentDir ) {
            if ( this.curDirInx + 1 >= this.arrOrder.length || this.currentDir().depth !== this.currentDir(1).depth ) {
                let i = 0;
                for ( i = this.curDirInx + 1; i <= this.arrOrder.length - 1; i++ ) {
                    if ( this.arrOrder[i].depth === this.currentDir().depth ) {
                        break;
                    }
                }
                if ( i <= this.arrOrder.length - 1) {
                    this.curDirInx = i;
                } else {
                    await this.keyRightPromise();
                }
            } else {
                this.curDirInx++;
            }
        }
    }

    keyHome() {
        this.setCurrentDir(path.sep);
    }

    keyEnd() {
        while(!this.currentDir().subDir.length) {
            this.curDirInx = this.currentDir().subDir[0].index;
        }
    }

    @Help("scan one or all subdirectory")
    async subDirScanPromise( depth: number = 1 ) {
        let node = this.currentDir();
        this.hideSubDir( node );
        await this.scan( node, depth );
    }

    @Help("hide subdirectory")
    subDirHide() {
        let node = this.currentDir();
        this.hideSubDir( node );
    }
}

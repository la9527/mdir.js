import * as fs from "fs";
import * as path from "path";

import { SortType } from "../common/Sort";
import { Dir } from "../common/Dir";
import { Reader } from "../common/Reader";
import { File } from "../common/File";
import { readerControl } from "./readerControl";
import { Logger } from "../common/Logger";

const log = Logger("blessed-mcd");

export class Mcd {
    protected sortType: SortType = SortType.COLOR;

    protected isSort: boolean = false;
    protected isHidden: boolean = false;

    protected arrOrder: Dir[] = [];

    protected scrollRow: number = 0;
    protected scrollCol: number = 0;

    protected reader: Reader = null;
    protected rootDir: Dir = null;

    protected curDirInx: number = -1;

    getReader(): Reader {
        return this.reader;
    }
    
    initReader( type: string = "file" ) {
        this.reader = readerControl(type);
    }

    async scanCurrentDir() {
        const dir: File = this.reader.currentDir();
        let scanDepth = dir.fullname.split(path.sep).length + 2;
        log.debug( "scanDepth %d", scanDepth);
        await this.rescan(scanDepth || 1);
        this.setCurrentDir(dir.fullname);
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

        while( arrDir.length != 0 ) {
            pTree = arrDir.pop();

            let dirInfo: File[] = await this.reader.readdir( pTree.file );
            dirInfo.map( item => {
                if ( item.dir && !item.link ) {
                    if ( pTree.subDir.findIndex( s => s.file.equal(item) ) == -1 ) {
                        pTree.subDir.push( new Dir( item, pTree, false ) );
                    }
                }
            });

            pTree.check = true;
            // TODO: sort 기능 적용 필요
            // sort(pTree->vNode.begin(), pTree->vNode.end(), McdSort());

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
                log.debug( "[%s] [%s]", item.file.fullname, path );
                return item.file.fullname === path;
            });
            this.curDirInx = findDir > -1 ? findDir : 0;
            log.debug( "findIndex: [%s] %d [%d/%d]", path, findDir, this.curDirInx, this.arrOrder.length);
        }
    }

    getDirRowArea( findRow: number, depth: number ): Dir {
        let tempNodeOver = [];
        let tempNodeUnder = [];
        
        this.arrOrder.map( (item) => {
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

    searchDir( dirPath: string ): Dir {
        if ( !dirPath || this.rootDir == null ) {
            return null;
        }

        const findSubDir = (baseDir: Dir, subPath) => {
            let pathArr = subPath.split(path.sep);
            const lastPathname = pathArr.shift();
            const findDir = baseDir.subDir.find(i => i.file.name === lastPathname);
            if ( !findDir ) {
                return baseDir;
            }
            return findSubDir( findDir, pathArr );
        };
        if ( dirPath[0] === path.sep ) {
            dirPath = dirPath.substr(0,1);
        }
        return findSubDir( this.rootDir, dirPath );
    }

    async addDirectory( dirPath: string ): Promise<Boolean> {
        const dir: Dir = this.searchDir( dirPath );
        if ( !dir ) {
            return false;
        }
        return await this.scan( dir );
    }

    currentDir(num: number = undefined, isChange = false ): Dir {
        let x = this.curDirInx;
        if ( typeof(num) === "number" ) {
            x = this.curDirInx + num;
        }
        if ( x <= -1 || x >= this.arrOrder.length ) {
            x = this.curDirInx;
            if ( isChange ) {
                this.curDirInx = x;
            }
        }
        return this.arrOrder[ x ];
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
            const name = this.currentDir().file.fullname;
            await this.scan( this.currentDir(), 1 );
            this.setCurrentDir(name);
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
}

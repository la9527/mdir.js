import { Reader } from "../common/Reader";
import { File } from "../common/File";
import { fileURLToPath } from "url";
import { log } from "winston";

export enum ClipBoard {
    CLIP_NONE,
    CLIP_COPY,
    CLIP_CUT
}

let gSelection: Selection = null;

export class Selection {
    private arrFiles: File[] = [];
    private selectedBaseDir: File = null;
    private isExpandDir = false;
    private stateClipboard: ClipBoard = ClipBoard.CLIP_NONE;

    getClipboard() {
        return this.stateClipboard;
    }

    getSelecteBaseDir(): File {
        return this.selectedBaseDir;
    }

    set( files: File[], selectedBaseDir: File, stateClipboard: ClipBoard ) {
        this.arrFiles = files;
        this.stateClipboard = stateClipboard;
        this.selectedBaseDir = selectedBaseDir;
        this.isExpandDir = false;
    }

    clear() {
        this.arrFiles = [];
        this.isExpandDir = false;
    }

    push( file: File ) {
        this.arrFiles.push( file );
    }

    get length() {
        return this.arrFiles;
    }

    getFiles() {
        return this.arrFiles;
    }

    get( number ) {
        return this.arrFiles[number];
    }

    get size() {
        return this.arrFiles.reduce( (size, file) => size + file.size, 0);
    }

    getExpandSize() {
        return this.size;
    }

    async expandDir(reader: Reader): Promise<boolean> {
        if ( this.isExpandDir || !reader ) {
            return false;
        }

        interface IDir {
            dirFile: File;
            checked: boolean;
        }

        let arrDirs: IDir[] = [];
        this.arrFiles.forEach( (item) => item.dir && !item.link && arrDirs.push( { dirFile: item, checked: false } ) );

        let result = false;

        const beforeDir = reader.currentDir();
        for ( ;; ) {
            let dir = arrDirs.find( (item) => !item.checked );
            if ( !dir ) {
                result = true;
                break;
            }

            dir.checked = true;

            if ( reader.isUserCanceled ) {
                reader.isUserCanceled = false;
                result = false;
                break;
            }

            const files = await reader.readdir( dir.dirFile );
            files && files.forEach( (item) => {
                if ( item.fullname !== dir.dirFile.fullname && item.dir && !item.link ) {
                    arrDirs.push( { dirFile: item, checked: false } );
                }
            });

            this.arrFiles = this.arrFiles.concat( files );
        }

        reader.readdir(beforeDir);
        this.isExpandDir = true;
        return true;
    }

    static instance() {
        if ( !gSelection ){
            gSelection = new Selection();
        }
        return gSelection;
    }
}

export default function selection(): Selection {
    return Selection.instance();
}

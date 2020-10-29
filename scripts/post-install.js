const os = require("os");
const fs = require("fs");

function fileAppendText( insertText, fileName, matchText ) {
    try {
        if ( fs.existsSync(fileName) ) {
            let data = fs.readFileSync( fileName, "utf8" );
            let lines = data.split("\n");
            let find = false;
            lines = lines.map( (item) => {
                if ( item.match( matchText ) ) {
                    find = true;
                    return insertText;
                }
                return item;
            });
            if ( !find ) {
                lines.push( insertText );
                lines.push( "" );
            }
            fs.writeFileSync( fileName, lines.join("\n") );
            return true;
        }
    } catch( e ) {
        console.error( e );
    }
    return false;
}


function scriptUpdate() {
    let basePath = fs.realpathSync( __dirname );
    basePath = fs.realpathSync( basePath + "/..");
    if ( !fs.existsSync(`${basePath}/.git`) ) {
        try {
            if ( fs.existsSync("/bin/bash") ) {
                console.log( `Update: ${basePath}/bin/mdir -> ${basePath}/bin/mdir.js` );
                fs.copyFileSync( basePath + "/bin/mdir", basePath + "/bin/mdir.js" );

                console.log( `Update: ${basePath}/bin/mdir.sh -> ${basePath}/bin/mdir` );
                fs.copyFileSync( basePath + "/bin/mdir.sh", basePath + "/bin/mdir" );

                [ os.homedir() + "/.bashrc", os.homedir() + "/.zshrc" ].forEach( item => {
                    if ( fileAppendText( `alias mdir=". ${basePath}/bin/mdir"`, item, /^alias mdir/ ) ) {
                        console.log( `Update: alias mdir >> ${item}` );
                    }
                });
            } else {
                [ os.homedir() + "/.profile" ].forEach( item => {
                    if ( fileAppendText( `alias mdir="${basePath}/bin/mdir"`, item, /^alias mdir/ ) ) {
                        console.log( `Update: alias mdir >> ${item}` );
                    }
                });
            }
        } catch( e ) {
            console.error( e );
        }
    }
}

if ( os.platform() !== "win32" ) {
    scriptUpdate();
}

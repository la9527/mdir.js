# Instruction

Mdir.js is a visual file manager.

It's a feature rich full-screen text mode application that allows you to copy, move and delete files and whole directory trees, search for files and run commands in the sub-shell.

It's a clone of Mdir, the famous file manager from the MS-DOS age. Mdir.js inherits the keyboard shortcuts and the screen layout from Mdir to maximize user-friendliness.

For bug reports, comments and questions, please email to la9527@daum.net

# Requirements

 - Node.js >= 10.x

# Tested OS

 - Windows 10
 - MAC OSX Catalina (10.15.x)
 - Ubuntu Linux

# License

 Mdir.js is distributed under the BSD 3-Clause License.
 See ['LICENSE'] for the detail.

# Installation

### 1. Install

```bash
$ npm install mdir.js -g
```

### 2. Run 

```bash
$ mdir
```

### Version History


- v0.8.0
    - Support the compress files (zip, tar.gz, gz, bz2)
      (archive file viewer, uncompress)
- v0.7.x
    - Support the simple editor in the window box. (auto detect text file encoding)
- v0.6.x 
    - Support korean text translation.
- v0.5.x 
    - Support the image text viewer. (png, jpeg, gif)
    - Support the true color image in the iTerm for MacOS only.
- v0.4.x 
    - Support the terminal(sub shell) in the window box.
- v0.2.x
    - Add the hint at the bottom side.
    - Add the command line at the bottom side (press slash('/') key)
- v0.1.x
    - Support the mcd(directory changer of tree design) in the window box.

# Gallery

![MDir MAIN](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.1_windows10_cmd.png?raw=true)

![Mdir.js MCD](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.1_windows10_cmd_mcd.png?raw=true)

![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v3.0_macos_terminal.png?raw=true)

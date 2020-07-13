const unicode = require("neo-blessed/lib/unicode");
const { supportsColor } = require("supports-color");

var angles = {
  '\u2518': true, // '┘'
  '\u2510': true, // '┐'
  '\u250c': true, // '┌'
  '\u2514': true, // '└'
  '\u253c': true, // '┼'
  '\u251c': true, // '├'
  '\u2524': true, // '┤'
  '\u2534': true, // '┴'
  '\u252c': true, // '┬'
  '\u2502': true, // '│'
  '\u2500': true  // '─'
};

const supportColorLevel = supportsColor(process.stdout);

// blessed screen.draw() redesign - true(rgb) color support
exports.draw = function(start, end) {
    let item = this;

    let x
      , y
      , line
      , out
      , ch
      , data
      , attr
      , fg
      , bg
      , flags
      , rgbColors;
  
    let main = ''
      , pre
      , post;
  
    let clr
      , neq
      , xx;
  
    let lx = -1
      , ly = -1
      , o;
  
      let acs;  
    
    if (this._buf) {
      main += this._buf;
      this._buf = '';
    }
  
    for (y = start; y <= end; y++) {
      line = this.lines[y];
      o = this.olines[y];
  
      if (!line.dirty && !(this.cursor.artificial && y === this.program.y)) {
        continue;
      }
      line.dirty = false;
  
      out = '';
      attr = this.dattr;
  
      for (x = 0; x < line.length; x++) {
        data = line[x][0];
        ch = line[x][1];
        rgbColors = line[x][2];
  
        // Render the artificial cursor.
        if (this.cursor.artificial
            && !this.cursor._hidden
            && this.cursor._state
            && x === this.program.x
            && y === this.program.y) {
          var cattr = this._cursorAttr(this.cursor, data);
          if (cattr.ch) ch = cattr.ch;
          data = cattr.attr;
        }
  
        // Take advantage of xterm's back_color_erase feature by using a
        // lookahead. Stop spitting out so many damn spaces. NOTE: Is checking
        // the bg for non BCE terminals worth the overhead?
        if (this.options.useBCE
            && ch === ' '
            && (this.tput.bools.back_color_erase
            || (data & 0x1ff) === (this.dattr & 0x1ff))
            && ((data >> 18) & 8) === ((this.dattr >> 18) & 8)) {
          clr = true;
          neq = false;
  
          for (xx = x; xx < line.length; xx++) {
            if (line[xx][0] !== data || line[xx][1] !== ' ') {
              clr = false;
              break;
            }
            if (line[xx][0] !== o[xx][0] || line[xx][1] !== o[xx][1]) {
              neq = true;
            }
          }
  
          if (clr && neq) {
            lx = -1, ly = -1;
            if (data !== attr) {
              out += this.codeAttr(data);
              attr = data;
            }
            out += this.tput.cup(y, x);
            out += this.tput.el();
            for (xx = x; xx < line.length; xx++) {
              o[xx][0] = data;
              o[xx][1] = ' ';
            }
            break;
          }
        }
  
        // Optimize by comparing the real output
        // buffer to the pending output buffer.
        if (data === o[x][0] && ch === o[x][1]) {
          if (lx === -1) {
            lx = x;
            ly = y;
          }
          continue;
        } else if (lx !== -1) {
          if (this.tput.strings.parm_right_cursor) {
            out += y === ly
              ? this.tput.cuf(x - lx)
              : this.tput.cup(y, x);
          } else {
            out += this.tput.cup(y, x);
          }
          lx = -1, ly = -1;
        }
        o[x][0] = data;
        o[x][1] = ch;
  
        if (data !== attr) {
          if (attr !== this.dattr) {
            out += '\x1b[m';
          }
          if (data !== this.dattr) {
            out += '\x1b[';
  
            bg = data & 0x1ff;
            fg = (data >> 9) & 0x1ff;
            flags = data >> 18;
  
            // bold
            if (flags & 1) {
              out += '1;';
            }
  
            // underline
            if (flags & 2) {
              out += '4;';
            }
  
            // blink
            if (flags & 4) {
              out += '5;';
            }
  
            // inverse
            if (flags & 8) {
              out += '7;';
            }
  
            // invisible
            if (flags & 16) {
              out += '8;';
            }

            // rgb(true) color support
            if ( supportColorLevel.level > 2 && rgbColors ) {
              const rgbText = ( num, { r, g, b } ) => {
                return `${num};2;${r};${g};${b}`;
              };
              out += rgbText(48, rgbColors.bg);
              if ( rgbColors.fg ) {
                out += 'm\x1b[' + rgbText(38, rgbColors.fg);
              }
            } else {
              if (bg !== 0x1ff) {
                bg = this._reduceColor(bg);
                if (bg < 16) {
                  if (bg < 8) {
                    bg += 40;
                  } else if (bg < 16) {
                    bg -= 8;
                    bg += 100;
                  }
                  out += bg + ';';
                } else {
                  out += '48;5;' + bg + ';';
                }
              }
    
              if (fg !== 0x1ff) {
                fg = this._reduceColor(fg);
                if (fg < 16) {
                  if (fg < 8) {
                    fg += 30;
                  } else if (fg < 16) {
                    fg -= 8;
                    fg += 90;
                  }
                  out += fg + ';';
                } else {
                  out += '38;5;' + fg + ';';
                }
              }
            }
  
            if (out[out.length - 1] === ';') out = out.slice(0, -1);
  
            out += 'm';
          }
        }
  
        // If we find a double-width char, eat the next character which should be
        // a space due to parseContent's behavior.
        if (this.fullUnicode) {
          // If this is a surrogate pair double-width char, we can ignore it
          // because parseContent already counted it as length=2.
          if (unicode.charWidth(line[x][1]) === 2) {
            // NOTE: At cols=44, the bug that is avoided
            // by the angles check occurs in widget-unicode:
            // Might also need: `line[x + 1][0] !== line[x][0]`
            // for borderless boxes?
            if (x === line.length - 1 || angles[line[x + 1][1]]) {
              // If we're at the end, we don't have enough space for a
              // double-width. Overwrite it with a space and ignore.
              ch = ' ';
              o[x][1] = '\0';
            } else {
              // ALWAYS refresh double-width chars because this special cursor
              // behavior is needed. There may be a more efficient way of doing
              // this. See above.
              o[x][1] = '\0';
              // Eat the next character by moving forward and marking as a
              // space (which it is).
              o[++x][1] = '\0';
            }
          }
        }
  
        // Attempt to use ACS for supported characters.
        // This is not ideal, but it's how ncurses works.
        // There are a lot of terminals that support ACS
        // *and UTF8, but do not declare U8. So ACS ends
        // up being used (slower than utf8). Terminals
        // that do not support ACS and do not explicitly
        // support UTF8 get their unicode characters
        // replaced with really ugly ascii characters.
        // It is possible there is a terminal out there
        // somewhere that does not support ACS, but
        // supports UTF8, but I imagine it's unlikely.
        // Maybe remove !this.tput.unicode check, however,
        // this seems to be the way ncurses does it.
        if (this.tput.strings.enter_alt_charset_mode
            && !this.tput.brokenACS && (this.tput.acscr[ch] || acs)) {
          // Fun fact: even if this.tput.brokenACS wasn't checked here,
          // the linux console would still work fine because the acs
          // table would fail the check of: this.tput.acscr[ch]
          if (this.tput.acscr[ch]) {
            if (acs) {
              ch = this.tput.acscr[ch];
            } else {
              ch = this.tput.smacs()
                + this.tput.acscr[ch];
              acs = true;
            }
          } else if (acs) {
            ch = this.tput.rmacs() + ch;
            acs = false;
          }
        } else {
          // U8 is not consistently correct. Some terminfo's
          // terminals that do not declare it may actually
          // support utf8 (e.g. urxvt), but if the terminal
          // does not declare support for ACS (and U8), chances
          // are it does not support UTF8. This is probably
          // the "safest" way to do this. Should fix things
          // like sun-color.
          // NOTE: It could be the case that the $LANG
          // is all that matters in some cases:
          // if (!this.tput.unicode && ch > '~') {
          if (!this.tput.unicode && this.tput.numbers.U8 !== 1 && ch > '~') {
            ch = this.tput.utoa[ch] || '?';
          }
        }
  
        out += ch;
        attr = data;
      }
  
      if (attr !== this.dattr) {
        out += '\x1b[m';
      }
  
      if (out) {
        main += this.tput.cup(y, 0) + out;
      }
    }
  
    if (acs) {
      main += this.tput.rmacs();
      acs = false;
    }
  
    if (main) {
      pre = '';
      post = '';
  
      pre += this.tput.sc();
      post += this.tput.rc();
  
      if (!this.program.cursorHidden) {
        pre += this.tput.civis();
        post += this.tput.cnorm();
      }
  
      this.program._write(pre + main + post);
    }
};

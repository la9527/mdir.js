#!/bin/sh

SHELL=`ps -p $$ -ocomm=`
SOURCE=$0
if [[ "$SHELL" =~ "bash" ]]; then
  SOURCE=$BASH_SOURCE
elif [[ "$SHELL" =~ "zsh" ]]; then
  SOURCE=${(%):-%N}
fi

realpath() {
  OURPWD=$PWD
  ORGFILE=$(which $1)
  cd "$(dirname "$ORGFILE")"
  LINK=$(readlink "$(basename "$1")")
  while [ "$LINK" ]; do
    cd "$(dirname "$LINK")"
    LINK=$(readlink "$(basename "$1")")
  done
  REALPATH="$PWD/$(basename "$1")"
  cd "$OURPWD"
  echo "$REALPATH"
}

REALPATH_MDIR=`realpath $SOURCE`
/usr/bin/env node $REALPATH_MDIR.js "$@"

MDIR_PWD_FILE="${HOME}/.m/path"
if test -r "$MDIR_PWD_FILE"; then
    MDIR_PWD="`cat $MDIR_PWD_FILE`"
    if test -n "$MDIR_PWD" && test -d "$MDIR_PWD"; then
        cd "$MDIR_PWD"
    fi
    unset MDIR_PWD
fi
unset MDIR_PWD_FILE
